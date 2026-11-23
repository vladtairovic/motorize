import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { InjectDb, Db } from '../db/db.module';
import { entregadores, servidores, sessoes } from '../db/schema';
import { AuditoriaService } from '../common/auditoria.service';
import type { Sujeito } from './auth.guard';
import { primeiroNome } from '../common/util';

export const VERSAO_TERMO_LGPD = '1.0';
const REFRESH_DIAS = 30;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private db: Db,
    private jwt: JwtService,
    private auditoria: AuditoriaService,
  ) {}

  hashSenha(senha: string) {
    return hash(senha, { memoryCost: 19456, timeCost: 2, parallelism: 1 }); // parâmetros OWASP
  }

  private async emitir(s: Sujeito, userAgent?: string) {
    const accessToken = this.jwt.sign(s, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    await this.db.insert(sessoes).values({
      sujeitoTipo: s.tipo,
      sujeitoId: s.sub,
      tokenHash: sha(refreshToken),
      expiraEm: new Date(Date.now() + REFRESH_DIAS * 864e5),
      userAgent: userAgent?.slice(0, 250),
    });
    return { accessToken, refreshToken, usuario: s };
  }

  async cadastrarEntregador(d: { cpf: string; nome: string; telefone: string; senha: string; aceiteTermo: true }, ip?: string, ua?: string) {
    const existe = await this.db.query.entregadores.findFirst({ where: eq(entregadores.cpf, d.cpf), columns: { id: true } });
    if (existe) throw new ConflictException('Já existe uma conta com este CPF. Use "Entrar".');
    const [e] = await this.db
      .insert(entregadores)
      .values({
        cpf: d.cpf,
        nome: d.nome.trim(),
        telefone: d.telefone,
        senhaHash: await this.hashSenha(d.senha),
        consentimentoEm: new Date(),
        consentimentoVersao: VERSAO_TERMO_LGPD,
      })
      .returning({ id: entregadores.id, nome: entregadores.nome });
    const s: Sujeito = { sub: e.id, tipo: 'ENTREGADOR', nome: primeiroNome(e.nome) };
    await this.auditoria.registrar(s, 'CONTA_CRIADA', 'entregador', e.id, { termo: VERSAO_TERMO_LGPD }, ip);
    return this.emitir(s, ua);
  }

  async loginEntregador(cpf: string, senha: string, ua?: string) {
    const e = await this.db.query.entregadores.findFirst({ where: eq(entregadores.cpf, cpf) });
    if (!e || e.anonimizadoEm || !(await verify(e.senhaHash, senha))) throw new UnauthorizedException('CPF ou senha incorretos.');
    return this.emitir({ sub: e.id, tipo: 'ENTREGADOR', nome: primeiroNome(e.nome) }, ua);
  }

  async loginServidor(email: string, senha: string, ip?: string, ua?: string) {
    const s = await this.db.query.servidores.findFirst({ where: eq(servidores.email, email.toLowerCase()) });
    if (!s || !s.ativo || !(await verify(s.senhaHash, senha))) throw new UnauthorizedException('E-mail ou senha incorretos.');
    await this.db.update(servidores).set({ ultimoAcessoEm: new Date() }).where(eq(servidores.id, s.id));
    const sujeito: Sujeito = { sub: s.id, tipo: 'SERVIDOR', papel: s.papel, nome: s.nome };
    await this.auditoria.registrar(sujeito, 'LOGIN', 'servidor', s.id, undefined, ip);
    return this.emitir(sujeito, ua);
  }

  /** Rotação: cada refresh token só pode ser usado uma vez. */
  async renovar(refreshToken: string, ua?: string) {
    const [sessao] = await this.db
      .update(sessoes)
      .set({ revogadaEm: new Date() })
      .where(and(eq(sessoes.tokenHash, sha(refreshToken)), isNull(sessoes.revogadaEm), gt(sessoes.expiraEm, new Date())))
      .returning();
    if (!sessao) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    let sujeito: Sujeito | null = null;
    if (sessao.sujeitoTipo === 'ENTREGADOR') {
      const e = await this.db.query.entregadores.findFirst({ where: eq(entregadores.id, sessao.sujeitoId) });
      if (e && !e.anonimizadoEm) sujeito = { sub: e.id, tipo: 'ENTREGADOR', nome: primeiroNome(e.nome) };
    } else {
      const s = await this.db.query.servidores.findFirst({ where: eq(servidores.id, sessao.sujeitoId) });
      if (s?.ativo) sujeito = { sub: s.id, tipo: 'SERVIDOR', papel: s.papel, nome: s.nome };
    }
    if (!sujeito) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    return this.emitir(sujeito, ua);
  }

  async sair(refreshToken: string) {
    await this.db.update(sessoes).set({ revogadaEm: new Date() }).where(eq(sessoes.tokenHash, sha(refreshToken)));
  }
}
