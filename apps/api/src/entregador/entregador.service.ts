import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql as dsql } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { InjectDb, Db, SQL } from '../db/db.module';
import {
  credenciais, documentos, entregadores, motocicletas, notificacoes, solicitacaoEventos, solicitacoes,
} from '../db/schema';
import { StorageService } from '../common/storage.service';
import { AuditoriaService } from '../common/auditoria.service';
import { novoProtocolo } from '../common/protocolo';
import type { Sujeito } from '../auth/auth.guard';

export const DOCS_OBRIGATORIOS = ['CNH', 'CRLV', 'COMPROVANTE_RESIDENCIA', 'FOTO'] as const;
export type TipoDoc = (typeof DOCS_OBRIGATORIOS)[number];
const EDITAVEL = ['RASCUNHO', 'PENDENCIA'] as const;

@Injectable()
export class EntregadorService {
  constructor(
    @InjectDb() private db: Db,
    @Inject(SQL) private sql: Sql,
    private storage: StorageService,
    private auditoria: AuditoriaService,
  ) {}

  /** Solicitação mais recente; cria um rascunho se ainda não existir nenhuma. */
  async solicitacaoAtual(entregadorId: string) {
    const atual = await this.db.query.solicitacoes.findFirst({
      where: eq(solicitacoes.entregadorId, entregadorId),
      orderBy: desc(solicitacoes.criadoEm),
    });
    if (atual) return atual;
    const [nova] = await this.db
      .insert(solicitacoes)
      .values({ entregadorId, protocolo: await novoProtocolo(this.sql) })
      .returning();
    await this.db.insert(solicitacaoEventos).values({
      solicitacaoId: nova.id, status: 'RASCUNHO', atorTipo: 'ENTREGADOR', atorId: entregadorId, mensagem: 'Cadastro iniciado',
    });
    return nova;
  }

  async painel(entregadorId: string) {
    const e = await this.db.query.entregadores.findFirst({
      where: eq(entregadores.id, entregadorId),
      columns: { senhaHash: false },
      with: { motocicleta: true },
    });
    if (!e) throw new NotFoundException();
    const sol = await this.solicitacaoAtual(entregadorId);
    const [docs, eventos, cred, naoLidas] = await Promise.all([
      this.db.query.documentos.findMany({
        where: eq(documentos.solicitacaoId, sol.id),
        orderBy: desc(documentos.criadoEm),
        columns: { caminho: false },
      }),
      this.db.query.solicitacaoEventos.findMany({
        where: eq(solicitacaoEventos.solicitacaoId, sol.id),
        orderBy: desc(solicitacaoEventos.criadoEm),
        columns: { atorId: false },
      }),
      this.db.query.credenciais.findFirst({
        where: eq(credenciais.entregadorId, entregadorId),
        orderBy: desc(credenciais.emitidaEm),
        columns: { token: false },
      }),
      this.db.$count(notificacoes, and(eq(notificacoes.entregadorId, entregadorId), isNull(notificacoes.lidaEm))),
    ]);
    // Documento vigente por tipo (o mais recente)
    const porTipo: Record<string, (typeof docs)[number]> = {};
    for (const d of docs) if (!porTipo[d.tipo]) porTipo[d.tipo] = d;

    const { localizacao, ...dados } = e;
    return {
      entregador: { ...dados, latitude: localizacao?.y ?? null, longitude: localizacao?.x ?? null },
      solicitacao: { ...sol, eventos },
      documentos: porTipo,
      credencial: cred ?? null,
      notificacoesNaoLidas: naoLidas,
      progresso: this.progresso(e, porTipo),
    };
  }

  private progresso(e: any, docs: Record<string, any>) {
    const dados = Boolean(e.bairro && e.dataNascimento && e.tipoAtividade && e.cnhNumero && e.cnhCategoria && e.cnhValidade);
    const moto = Boolean(e.motocicleta);
    const faltando = DOCS_OBRIGATORIOS.filter((t) => !docs[t] || docs[t].status === 'RECUSADO');
    return { dados, moto, documentos: faltando.length === 0, documentosFaltando: faltando };
  }

  private async exigirEditavel(entregadorId: string) {
    const sol = await this.solicitacaoAtual(entregadorId);
    if (!(EDITAVEL as readonly string[]).includes(sol.status))
      throw new BadRequestException(
        sol.status === 'APROVADA'
          ? 'Seu cadastro já foi aprovado. Para alterar dados, inicie uma renovação.'
          : 'Sua solicitação está em análise. Aguarde o resultado para alterar dados.',
      );
    return sol;
  }

  async atualizarDados(entregadorId: string, d: any) {
    await this.exigirEditavel(entregadorId);
    const { latitude, longitude, ...resto } = d;
    await this.db
      .update(entregadores)
      .set({
        ...resto,
        localizacao: latitude != null && longitude != null ? { x: longitude, y: latitude } : undefined,
        atualizadoEm: new Date(),
      })
      .where(eq(entregadores.id, entregadorId));
    return this.painel(entregadorId);
  }

  async salvarMoto(entregadorId: string, d: any) {
    await this.exigirEditavel(entregadorId);
    const outra = await this.db.query.motocicletas.findFirst({ where: eq(motocicletas.placa, d.placa) });
    if (outra && outra.entregadorId !== entregadorId) throw new BadRequestException('Esta placa já está cadastrada por outro entregador.');
    await this.db
      .insert(motocicletas)
      .values({ ...d, entregadorId })
      .onConflictDoUpdate({ target: motocicletas.entregadorId, set: d });
    return this.painel(entregadorId);
  }

  async enviarDocumento(entregadorId: string, tipo: TipoDoc, arquivo: { buffer: Buffer; mime: string }) {
    const sol = await this.exigirEditavel(entregadorId);
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[arquivo.mime];
    if (!ext) throw new BadRequestException('Envie uma foto (JPG, PNG) ou PDF.');
    if (tipo === 'FOTO' && ext === 'pdf') throw new BadRequestException('A foto da credencial precisa ser uma imagem.');
    const salvo = await this.storage.salvar(arquivo.buffer, `entregadores/${entregadorId}`, ext);
    const [doc] = await this.db
      .insert(documentos)
      .values({ entregadorId, solicitacaoId: sol.id, tipo, mime: arquivo.mime, ...salvo })
      .returning({ id: documentos.id, tipo: documentos.tipo, status: documentos.status, criadoEm: documentos.criadoEm });
    return doc;
  }

  async arquivoProprio(entregadorId: string, docId: string) {
    const d = await this.db.query.documentos.findFirst({ where: and(eq(documentos.id, docId), eq(documentos.entregadorId, entregadorId)) });
    if (!d) throw new NotFoundException();
    return { stream: this.storage.stream(d.caminho), mime: d.mime };
  }

  async enviarSolicitacao(entregadorId: string) {
    const sol = await this.exigirEditavel(entregadorId);
    const p = await this.painel(entregadorId);
    const faltas: string[] = [];
    if (!p.progresso.dados) faltas.push('dados pessoais e CNH');
    if (!p.progresso.moto) faltas.push('dados da motocicleta');
    if (!p.progresso.documentos) faltas.push(`documentos (${p.progresso.documentosFaltando.join(', ')})`);
    if (faltas.length) throw new BadRequestException(`Falta completar: ${faltas.join('; ')}.`);

    const reenvio = sol.status === 'PENDENCIA';
    await this.db
      .update(solicitacoes)
      .set({ status: 'ENVIADA', enviadaEm: reenvio ? sol.enviadaEm : new Date(), atualizadoEm: new Date() })
      .where(eq(solicitacoes.id, sol.id));
    await this.db.insert(solicitacaoEventos).values({
      solicitacaoId: sol.id, status: 'ENVIADA', atorTipo: 'ENTREGADOR', atorId: entregadorId,
      mensagem: reenvio ? 'Pendências corrigidas e reenviadas' : 'Solicitação enviada para análise',
    });
    return this.painel(entregadorId);
  }

  /** Renovação (credencial vencendo/vencida) ou nova tentativa após reprovação. Reaproveita documentos aceitos. */
  async iniciarRenovacao(entregadorId: string) {
    const sol = await this.solicitacaoAtual(entregadorId);
    const cred = await this.db.query.credenciais.findFirst({ where: eq(credenciais.entregadorId, entregadorId), orderBy: desc(credenciais.emitidaEm) });
    const pertoDoFim = cred && (cred.status === 'VENCIDA' || +cred.validaAte - Date.now() < 60 * 864e5);
    if (!(sol.status === 'REPROVADA' || (sol.status === 'APROVADA' && pertoDoFim)))
      throw new BadRequestException('A renovação abre 60 dias antes do vencimento da credencial.');
    const [nova] = await this.db
      .insert(solicitacoes)
      .values({ entregadorId, protocolo: await novoProtocolo(this.sql), tipo: sol.status === 'APROVADA' ? 'RENOVACAO' : 'INICIAL' })
      .returning();
    const aceitos = await this.db.query.documentos.findMany({ where: and(eq(documentos.solicitacaoId, sol.id), eq(documentos.status, 'ACEITO')) });
    if (aceitos.length)
      await this.db.insert(documentos).values(
        aceitos.map(({ id, criadoEm, status, motivoRecusa, solicitacaoId, ...d }) => ({ ...d, solicitacaoId: nova.id })),
      );
    await this.db.insert(solicitacaoEventos).values({
      solicitacaoId: nova.id, status: 'RASCUNHO', atorTipo: 'ENTREGADOR', atorId: entregadorId,
      mensagem: nova.tipo === 'RENOVACAO' ? 'Renovação iniciada' : 'Nova solicitação iniciada',
    });
    return this.painel(entregadorId);
  }

  async credencial(entregadorId: string) {
    const c = await this.db.query.credenciais.findFirst({
      where: and(eq(credenciais.entregadorId, entregadorId)),
      orderBy: desc(credenciais.emitidaEm),
      with: { entregador: { columns: { nome: true, nomeSocial: true, cpf: true, tipoAtividade: true }, with: { motocicleta: true } } },
    });
    if (!c) throw new NotFoundException('Você ainda não tem credencial. Ela aparece aqui quando o cadastro for aprovado.');
    const foto = await this.db.query.documentos.findFirst({
      where: and(eq(documentos.entregadorId, entregadorId), eq(documentos.tipo, 'FOTO'), eq(documentos.status, 'ACEITO')),
      orderBy: desc(documentos.criadoEm),
    });
    return {
      ...c,
      foto: foto ? `data:${foto.mime};base64,${await this.storage.lerBase64(foto.caminho)}` : null,
    };
  }

  notificacoes(entregadorId: string) {
    return this.db.query.notificacoes.findMany({
      where: eq(notificacoes.entregadorId, entregadorId),
      orderBy: desc(notificacoes.criadoEm),
      limit: 50,
    });
  }

  async marcarLidas(entregadorId: string) {
    await this.db
      .update(notificacoes)
      .set({ lidaEm: new Date() })
      .where(and(eq(notificacoes.entregadorId, entregadorId), isNull(notificacoes.lidaEm)));
  }

  /** LGPD art. 18, II — portabilidade/acesso aos próprios dados. */
  async exportar(u: Sujeito) {
    const p = await this.painel(u.sub);
    const consultasCount = await this.sql`
      SELECT count(*)::int AS n FROM consultas c JOIN credenciais cr ON cr.id = c.credencial_id WHERE cr.entregador_id = ${u.sub}`;
    await this.auditoria.registrar(u, 'EXPORTOU_PROPRIOS_DADOS', 'entregador', u.sub);
    return { geradoEm: new Date(), ...p, consultasEmCampo: consultasCount[0].n };
  }

  /** LGPD art. 18, VI — eliminação. Anonimiza mantendo apenas o necessário para auditoria. */
  async anonimizar(u: Sujeito) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(entregadores)
        .set({
          nome: 'Titular anonimizado', nomeSocial: null, email: null, telefone: '00000000000',
          cpf: `X${u.sub.replace(/-/g, '').slice(0, 10)}`, dataNascimento: null, logradouro: null, numero: null,
          localizacao: null, cnhNumero: null, anonimizadoEm: new Date(), senhaHash: '!',
        })
        .where(eq(entregadores.id, u.sub));
      await tx.update(credenciais).set({ status: 'REVOGADA', motivoStatus: 'Titular solicitou exclusão dos dados' }).where(eq(credenciais.entregadorId, u.sub));
      await tx.delete(motocicletas).where(eq(motocicletas.entregadorId, u.sub));
    });
    await this.auditoria.registrar(u, 'ANONIMIZACAO_SOLICITADA', 'entregador', u.sub);
  }
}
