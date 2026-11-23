import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql as dsql, SQL as DSQL } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { InjectDb, Db, SQL } from '../db/db.module';
import {
  auditoria, credenciais, documentos, entregadores, motocicletas, notificacoes, servidores, solicitacaoEventos, solicitacoes,
} from '../db/schema';
import { AuditoriaService } from '../common/auditoria.service';
import { StorageService } from '../common/storage.service';
import { CredencialService } from '../credencial/credencial.service';
import { DOCS_OBRIGATORIOS } from '../entregador/entregador.service';
import { somenteDigitos } from '../common/util';
import type { Sujeito } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';

type StatusSol = (typeof solicitacoes.$inferSelect)['status'];

@Injectable()
export class AdminService {
  constructor(
    @InjectDb() private db: Db,
    @Inject(SQL) private sql: Sql,
    private auditoria: AuditoriaService,
    private storage: StorageService,
    private credencial: CredencialService,
    private auth: AuthService,
  ) {}

  // ───────── Solicitações ─────────
  async listarSolicitacoes(q: { status?: string; busca?: string; pagina: number }) {
    const filtros: DSQL[] = [dsql`${solicitacoes.status} <> 'RASCUNHO'`];
    if (q.status) filtros.push(inArray(solicitacoes.status, q.status.split(',') as StatusSol[]));
    if (q.busca) {
      const b = q.busca.trim();
      const dig = somenteDigitos(b);
      filtros.push(
        or(
          ilike(entregadores.nome, `%${b}%`),
          ilike(solicitacoes.protocolo, `%${b}%`),
          ilike(motocicletas.placa, `%${b.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`),
          dig.length >= 3 ? ilike(entregadores.cpf, `%${dig}%`) : undefined,
        )!,
      );
    }
    const where = and(...filtros);
    const porPagina = 20;
    const [itens, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: solicitacoes.id,
          protocolo: solicitacoes.protocolo,
          status: solicitacoes.status,
          tipo: solicitacoes.tipo,
          enviadaEm: solicitacoes.enviadaEm,
          atualizadoEm: solicitacoes.atualizadoEm,
          qtdPendencias: solicitacoes.qtdPendencias,
          entregadorNome: entregadores.nome,
          bairro: entregadores.bairro,
          tipoAtividade: entregadores.tipoAtividade,
          placa: motocicletas.placa,
          analistaNome: servidores.nome,
        })
        .from(solicitacoes)
        .innerJoin(entregadores, eq(entregadores.id, solicitacoes.entregadorId))
        .leftJoin(motocicletas, eq(motocicletas.entregadorId, entregadores.id))
        .leftJoin(servidores, eq(servidores.id, solicitacoes.analistaId))
        .where(where)
        .orderBy(dsql`CASE ${solicitacoes.status} WHEN 'ENVIADA' THEN 0 WHEN 'EM_ANALISE' THEN 1 ELSE 2 END`, solicitacoes.enviadaEm)
        .limit(porPagina)
        .offset((q.pagina - 1) * porPagina),
      this.db
        .select({ total: dsql<number>`count(*)::int` })
        .from(solicitacoes)
        .innerJoin(entregadores, eq(entregadores.id, solicitacoes.entregadorId))
        .leftJoin(motocicletas, eq(motocicletas.entregadorId, entregadores.id))
        .where(where),
    ]);
    return { itens, total, pagina: q.pagina, porPagina };
  }

  async detalheSolicitacao(id: string, u: Sujeito, ip?: string) {
    const s = await this.db.query.solicitacoes.findFirst({
      where: eq(solicitacoes.id, id),
      with: {
        entregador: { columns: { senhaHash: false, localizacao: false }, with: { motocicleta: true } },
        analista: { columns: { id: true, nome: true } },
        eventos: { orderBy: desc(solicitacaoEventos.criadoEm) },
        documentos: { orderBy: desc(documentos.criadoEm), columns: { caminho: false } },
      },
    });
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    await this.auditoria.registrar(u, 'VISUALIZOU_SOLICITACAO', 'solicitacao', id, undefined, ip);
    const vigentes: Record<string, any> = {};
    for (const d of s.documentos) if (!vigentes[d.tipo]) vigentes[d.tipo] = d;
    const historico = await this.db
      .select({ id: solicitacoes.id, protocolo: solicitacoes.protocolo, status: solicitacoes.status, criadoEm: solicitacoes.criadoEm })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.entregadorId, s.entregadorId), dsql`${solicitacoes.id} <> ${id}`))
      .orderBy(desc(solicitacoes.criadoEm));
    const [geo] = await this.sql`
      SELECT ST_Y(localizacao) AS lat, ST_X(localizacao) AS lng FROM entregadores WHERE id = ${s.entregadorId}`;
    return {
      ...s,
      entregador: { ...s.entregador, latitude: geo?.lat ?? null, longitude: geo?.lng ?? null },
      documentosVigentes: vigentes,
      outrasSolicitacoes: historico,
    };
  }

  async iniciarAnalise(id: string, u: Sujeito) {
    const [s] = await this.db
      .update(solicitacoes)
      .set({ status: 'EM_ANALISE', analistaId: u.sub, analiseIniciadaEm: new Date(), atualizadoEm: new Date() })
      .where(and(eq(solicitacoes.id, id), eq(solicitacoes.status, 'ENVIADA')))
      .returning();
    if (!s) throw new ConflictException('Esta solicitação não está aguardando análise (talvez outro servidor já tenha assumido).');
    await this.db.insert(solicitacaoEventos).values({
      solicitacaoId: id, status: 'EM_ANALISE', atorTipo: 'SERVIDOR', atorId: u.sub, mensagem: 'Análise iniciada pela CTTU',
    });
    return s;
  }

  async avaliarDocumento(docId: string, d: { status: 'ACEITO' | 'RECUSADO'; motivoRecusa?: string }, u: Sujeito) {
    const doc = await this.db.query.documentos.findFirst({ where: eq(documentos.id, docId), with: { solicitacao: true } });
    if (!doc) throw new NotFoundException();
    if (doc.solicitacao?.status !== 'EM_ANALISE') throw new BadRequestException('Inicie a análise da solicitação antes de avaliar documentos.');
    if (d.status === 'RECUSADO' && !d.motivoRecusa?.trim()) throw new BadRequestException('Informe o motivo da recusa — o entregador vai ler.');
    const [r] = await this.db
      .update(documentos)
      .set({ status: d.status, motivoRecusa: d.status === 'RECUSADO' ? d.motivoRecusa!.trim() : null })
      .where(eq(documentos.id, docId))
      .returning({ id: documentos.id, status: documentos.status, motivoRecusa: documentos.motivoRecusa });
    await this.auditoria.registrar(u, `DOCUMENTO_${d.status}`, 'documento', docId, { tipo: doc.tipo });
    return r;
  }

  async arquivo(docId: string, u: Sujeito, ip?: string) {
    const d = await this.db.query.documentos.findFirst({ where: eq(documentos.id, docId) });
    if (!d) throw new NotFoundException();
    await this.auditoria.registrar(u, 'ABRIU_DOCUMENTO', 'documento', docId, { tipo: d.tipo, entregadorId: d.entregadorId }, ip);
    return { stream: this.storage.stream(d.caminho), mime: d.mime };
  }

  async decidir(id: string, d: { decisao: 'APROVAR' | 'PENDENCIA' | 'REPROVAR'; motivo?: string }, u: Sujeito) {
    const s = await this.db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { documentos: true } });
    if (!s) throw new NotFoundException();
    if (s.status !== 'EM_ANALISE') throw new BadRequestException('Só é possível decidir solicitações em análise.');
    const vigentes: Record<string, (typeof s.documentos)[number]> = {};
    for (const doc of [...s.documentos].sort((a, b) => +b.criadoEm - +a.criadoEm)) if (!vigentes[doc.tipo]) vigentes[doc.tipo] = doc;
    const recusados = Object.values(vigentes).filter((x) => x.status === 'RECUSADO');

    if (d.decisao === 'APROVAR') {
      const naoAceitos = DOCS_OBRIGATORIOS.filter((t) => vigentes[t]?.status !== 'ACEITO');
      if (naoAceitos.length) throw new BadRequestException(`Aceite todos os documentos antes de aprovar. Faltam: ${naoAceitos.join(', ')}.`);
    }
    if (d.decisao === 'PENDENCIA' && !recusados.length && !d.motivo?.trim())
      throw new BadRequestException('Recuse ao menos um documento ou descreva a pendência.');
    if (d.decisao === 'REPROVAR' && !d.motivo?.trim()) throw new BadRequestException('Informe o motivo da reprovação.');

    const novoStatus: StatusSol = d.decisao === 'APROVAR' ? 'APROVADA' : d.decisao === 'PENDENCIA' ? 'PENDENCIA' : 'REPROVADA';
    const motivoPendencia = [
      ...recusados.map((r) => `${rotuloDoc(r.tipo)}: ${r.motivoRecusa}`),
      d.motivo?.trim(),
    ].filter(Boolean).join('\n');

    return this.db.transaction(async (tx) => {
      await tx
        .update(solicitacoes)
        .set({
          status: novoStatus,
          motivo: d.decisao === 'PENDENCIA' ? motivoPendencia : d.motivo?.trim() || null,
          decididaEm: d.decisao === 'PENDENCIA' ? null : new Date(),
          qtdPendencias: d.decisao === 'PENDENCIA' ? s.qtdPendencias + 1 : s.qtdPendencias,
          analistaId: u.sub,
          atualizadoEm: new Date(),
        })
        .where(eq(solicitacoes.id, id));
      await tx.insert(solicitacaoEventos).values({
        solicitacaoId: id, status: novoStatus, atorTipo: 'SERVIDOR', atorId: u.sub,
        mensagem: d.decisao === 'APROVAR' ? 'Cadastro aprovado. Credencial emitida.' : d.decisao === 'PENDENCIA' ? motivoPendencia : d.motivo,
      });
      let credencial = null;
      if (d.decisao === 'APROVAR') {
        credencial = await this.credencial.emitir(s.entregadorId, id, tx as unknown as Db);
        await this.credencial.notificar(s.entregadorId, 'Cadastro aprovado', `Sua credencial ${credencial.numero} já está disponível no app.`, 'APROVACAO', tx as unknown as Db);
      } else if (d.decisao === 'PENDENCIA') {
        await this.credencial.notificar(s.entregadorId, 'Seu cadastro tem pendências', motivoPendencia, 'PENDENCIA', tx as unknown as Db);
      } else {
        await this.credencial.notificar(s.entregadorId, 'Cadastro não aprovado', d.motivo!, 'INFO', tx as unknown as Db);
      }
      await this.auditoria.registrar(u, `SOLICITACAO_${novoStatus}`, 'solicitacao', id);
      return { status: novoStatus, credencial: credencial ? { numero: credencial.numero, validaAte: credencial.validaAte } : null };
    });
  }

  // ───────── Entregadores / credenciais ─────────
  async listarEntregadores(q: { busca?: string; situacao?: string; bairro?: string; pagina: number }) {
    const porPagina = 25;
    const b = q.busca?.trim() ?? '';
    const dig = somenteDigitos(b);
    const placa = b.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rows = await this.sql`
      WITH base AS (
        SELECT e.id, e.nome, e.bairro, e.tipo_atividade, e.telefone, e.criado_em, e.cnh_validade,
               m.placa, m.modelo,
               c.numero AS credencial, c.status AS credencial_status, c.valida_ate,
               s.status AS solicitacao_status,
               CASE
                 WHEN c.status = 'ATIVA' AND c.valida_ate < now() THEN 'VENCIDA'
                 WHEN c.status IS NOT NULL AND c.status <> 'REVOGADA' THEN c.status::text
                 WHEN s.status IS NOT NULL THEN s.status::text
                 ELSE 'RASCUNHO'
               END AS situacao
        FROM entregadores e
        LEFT JOIN motocicletas m ON m.entregador_id = e.id
        LEFT JOIN LATERAL (SELECT * FROM credenciais WHERE entregador_id = e.id ORDER BY emitida_em DESC LIMIT 1) c ON true
        LEFT JOIN LATERAL (SELECT * FROM solicitacoes WHERE entregador_id = e.id ORDER BY criado_em DESC LIMIT 1) s ON true
        WHERE e.anonimizado_em IS NULL
          AND (${b} = '' OR e.nome ILIKE ${'%' + b + '%'} OR m.placa ILIKE ${'%' + (placa || '§') + '%'}
               OR c.numero ILIKE ${'%' + b + '%'} OR (${dig.length >= 3} AND e.cpf LIKE ${'%' + dig + '%'}))
          AND (${q.bairro ?? ''} = '' OR e.bairro = ${q.bairro ?? ''})
      )
      SELECT *, count(*) OVER()::int AS total FROM base
      WHERE (${q.situacao ?? ''} = '' OR situacao = ${q.situacao ?? ''})
      ORDER BY nome
      LIMIT ${porPagina} OFFSET ${(q.pagina - 1) * porPagina}`;
    return {
      itens: rows.map(({ total, ...r }) => r),
      total: rows[0]?.total ?? 0,
      pagina: q.pagina,
      porPagina,
    };
  }

  async detalheEntregador(id: string, u: Sujeito, ip?: string) {
    const e = await this.db.query.entregadores.findFirst({
      where: eq(entregadores.id, id),
      columns: { senhaHash: false },
      with: {
        motocicleta: true,
        credenciais: { orderBy: desc(credenciais.emitidaEm), columns: { token: false } },
        solicitacoes: { orderBy: desc(solicitacoes.criadoEm) },
      },
    });
    if (!e) throw new NotFoundException();
    await this.auditoria.registrar(u, 'VISUALIZOU_ENTREGADOR', 'entregador', id, undefined, ip);
    const consultas = await this.sql`
      SELECT c.realizada_em, c.resultado, c.offline, s.nome AS agente
      FROM consultas c JOIN credenciais cr ON cr.id = c.credencial_id JOIN servidores s ON s.id = c.agente_id
      WHERE cr.entregador_id = ${id} ORDER BY c.realizada_em DESC LIMIT 20`;
    const { localizacao, ...resto } = e;
    return { ...resto, latitude: localizacao?.y ?? null, longitude: localizacao?.x ?? null, foto: await this.credencial.foto(id), consultas };
  }

  async alterarStatusCredencial(id: string, d: { status: 'ATIVA' | 'SUSPENSA' | 'REVOGADA'; motivo: string }, u: Sujeito) {
    const c = await this.db.query.credenciais.findFirst({ where: eq(credenciais.id, id) });
    if (!c) throw new NotFoundException();
    if (c.status === 'REVOGADA') throw new BadRequestException('Credencial revogada não pode ser reativada. Abra nova solicitação.');
    await this.db.update(credenciais).set({ status: d.status, motivoStatus: d.motivo, atualizadoEm: new Date() }).where(eq(credenciais.id, id));
    const titulos = { ATIVA: 'Credencial reativada', SUSPENSA: 'Credencial suspensa', REVOGADA: 'Credencial revogada' };
    await this.credencial.notificar(c.entregadorId, titulos[d.status], d.motivo, 'INFO');
    await this.auditoria.registrar(u, `CREDENCIAL_${d.status}`, 'credencial', id, { motivo: d.motivo });
    return { ok: true };
  }

  // ───────── Comunicação institucional ─────────
  async comunicado(d: { titulo: string; mensagem: string; bairro?: string }, u: Sujeito) {
    const r = await this.sql`
      INSERT INTO notificacoes (entregador_id, titulo, mensagem, tipo)
      SELECT id, ${d.titulo}, ${d.mensagem}, 'COMUNICADO' FROM entregadores
      WHERE anonimizado_em IS NULL AND (${d.bairro ?? ''} = '' OR bairro = ${d.bairro ?? ''})`;
    await this.auditoria.registrar(u, 'COMUNICADO_ENVIADO', 'notificacao', null, { titulo: d.titulo, destinatarios: r.count, bairro: d.bairro });
    return { destinatarios: r.count };
  }

  async comunicadosRecentes() {
    return this.sql`
      SELECT titulo, mensagem, min(criado_em) AS enviado_em, count(*)::int AS destinatarios, count(lida_em)::int AS lidas
      FROM notificacoes WHERE tipo = 'COMUNICADO'
      GROUP BY titulo, mensagem, date_trunc('minute', criado_em)
      ORDER BY enviado_em DESC LIMIT 20`;
  }

  // ───────── Servidores ─────────
  listarServidores() {
    return this.db.query.servidores.findMany({ columns: { senhaHash: false }, orderBy: servidores.nome });
  }

  async criarServidor(d: { nome: string; email: string; senha: string; papel: any; matricula?: string; orgao: string }, u: Sujeito) {
    const existe = await this.db.query.servidores.findFirst({ where: eq(servidores.email, d.email.toLowerCase()) });
    if (existe) throw new ConflictException('Já existe um servidor com este e-mail.');
    const [s] = await this.db
      .insert(servidores)
      .values({ ...d, email: d.email.toLowerCase(), senhaHash: await this.auth.hashSenha(d.senha) })
      .returning({ id: servidores.id, nome: servidores.nome, email: servidores.email, papel: servidores.papel });
    await this.auditoria.registrar(u, 'SERVIDOR_CRIADO', 'servidor', s.id, { papel: d.papel });
    return s;
  }

  async alternarServidor(id: string, ativo: boolean, u: Sujeito) {
    if (id === u.sub) throw new BadRequestException('Você não pode desativar o próprio acesso.');
    await this.db.update(servidores).set({ ativo }).where(eq(servidores.id, id));
    await this.auditoria.registrar(u, ativo ? 'SERVIDOR_ATIVADO' : 'SERVIDOR_DESATIVADO', 'servidor', id);
    return { ok: true };
  }

  async listarAuditoria(pagina: number) {
    return this.sql`
      SELECT a.id, a.ator_tipo, a.acao, a.entidade, a.entidade_id, a.detalhes, a.ip, a.criado_em,
             COALESCE(s.nome, e.nome, 'Sistema') AS ator_nome
      FROM auditoria a
      LEFT JOIN servidores s ON a.ator_tipo = 'SERVIDOR' AND s.id = a.ator_id
      LEFT JOIN entregadores e ON a.ator_tipo = 'ENTREGADOR' AND e.id = a.ator_id
      ORDER BY a.criado_em DESC LIMIT 50 OFFSET ${(pagina - 1) * 50}`;
  }

  async bairros() {
    const r = await this.sql`SELECT DISTINCT bairro FROM entregadores WHERE bairro IS NOT NULL ORDER BY bairro`;
    return r.map((x) => x.bairro as string);
  }
}

export function rotuloDoc(t: string) {
  return ({ CNH: 'CNH', CRLV: 'Documento da moto (CRLV)', COMPROVANTE_RESIDENCIA: 'Comprovante de residência', FOTO: 'Foto' } as Record<string, string>)[t] ?? t;
}
