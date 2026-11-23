import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { InjectDb, Db, SQL } from '../db/db.module';
import { credenciais, documentos, entregadores, notificacoes } from '../db/schema';
import { assinarCredencial, garantirChaves, verificarCredencial } from '../common/chaves';
import { mascararCpf, primeiroNome } from '../common/util';
import { novoNumeroCredencial } from '../common/protocolo';
import { StorageService } from '../common/storage.service';

export type Resultado = 'VALIDA' | 'VENCIDA' | 'SUSPENSA' | 'REVOGADA' | 'INVALIDA' | 'NAO_ENCONTRADA';

@Injectable()
export class CredencialService {
  constructor(@InjectDb() private db: Db, @Inject(SQL) private sql: Sql, private storage: StorageService) {}

  async emitir(entregadorId: string, solicitacaoId: string, tx: Db = this.db) {
    const e = await tx.query.entregadores.findFirst({ where: eq(entregadores.id, entregadorId), with: { motocicleta: true } });
    if (!e?.motocicleta) throw new Error('Entregador sem motocicleta');
    // Credenciais anteriores ficam substituídas
    await tx
      .update(credenciais)
      .set({ status: 'REVOGADA', motivoStatus: 'Substituída por nova emissão', atualizadoEm: new Date() })
      .where(and(eq(credenciais.entregadorId, entregadorId), inArray(credenciais.status, ['ATIVA', 'SUSPENSA', 'VENCIDA'])));

    const meses = Number(process.env.CREDENCIAL_VALIDADE_MESES ?? 12);
    const emitidaEm = new Date();
    const validaAte = new Date(emitidaEm);
    validaAte.setMonth(validaAte.getMonth() + meses);
    // A credencial não pode valer além da CNH
    if (e.cnhValidade && new Date(e.cnhValidade + 'T23:59:59') < validaAte) validaAte.setTime(new Date(e.cnhValidade + 'T23:59:59').getTime());

    const numero = await novoNumeroCredencial(this.sql);
    const token = assinarCredencial({
      n: numero,
      nm: primeiroNome(e.nomeSocial || e.nome),
      cpf: mascararCpf(e.cpf),
      pl: e.motocicleta.placa,
      at: e.tipoAtividade ?? 'AUTONOMO',
      em: Math.floor(emitidaEm.getTime() / 1000),
      ex: Math.floor(validaAte.getTime() / 1000),
    });
    const [c] = await tx
      .insert(credenciais)
      .values({ numero, entregadorId, solicitacaoId, emitidaEm, validaAte, token })
      .returning();
    return c;
  }

  chavePublica() {
    const { publicRaw, kid } = garantirChaves();
    return { alg: 'Ed25519', kid, x: publicRaw };
  }

  /** Validação online: assinatura + status atual no banco. */
  async validarToken(token: string) {
    const p = verificarCredencial(token);
    if (!p) return { resultado: 'INVALIDA' as Resultado, credencial: null };
    const c = await this.db.query.credenciais.findFirst({
      where: eq(credenciais.numero, p.n),
      with: { entregador: { columns: { id: true, nome: true, nomeSocial: true }, with: { motocicleta: true } } },
    });
    if (!c) return { resultado: 'NAO_ENCONTRADA' as Resultado, credencial: null, payload: p };
    let resultado: Resultado = 'VALIDA';
    if (c.status === 'REVOGADA') resultado = 'REVOGADA';
    else if (c.status === 'SUSPENSA') resultado = 'SUSPENSA';
    else if (c.status === 'VENCIDA' || c.validaAte < new Date()) resultado = 'VENCIDA';
    return { resultado, credencial: c, payload: p };
  }

  async foto(entregadorId: string) {
    const f = await this.db.query.documentos.findFirst({
      where: and(eq(documentos.entregadorId, entregadorId), eq(documentos.tipo, 'FOTO'), eq(documentos.status, 'ACEITO')),
      orderBy: desc(documentos.criadoEm),
    });
    if (!f) return null;
    const b64 = await this.storage.lerBase64(f.caminho);
    return b64 ? `data:${f.mime};base64,${b64}` : null;
  }

  async notificar(entregadorId: string, titulo: string, mensagem: string, tipo: string, tx: Db = this.db) {
    await tx.insert(notificacoes).values({ entregadorId, titulo, mensagem, tipo });
  }
}
