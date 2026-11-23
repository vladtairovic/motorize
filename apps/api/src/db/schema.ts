import {
  pgTable, pgEnum, uuid, text, varchar, timestamp, date, integer, boolean,
  geometry, index, uniqueIndex, jsonb, smallint,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ───────────── Enums ─────────────
export const papelServidor = pgEnum('papel_servidor', ['ADMIN', 'ANALISTA', 'AGENTE', 'GESTOR']);
export const tipoAtividade = pgEnum('tipo_atividade', ['APP_DELIVERY', 'MOTOFRETE', 'MOTOTAXI', 'AUTONOMO']);
export const statusSolicitacao = pgEnum('status_solicitacao', [
  'RASCUNHO', 'ENVIADA', 'EM_ANALISE', 'PENDENCIA', 'APROVADA', 'REPROVADA',
]);
export const tipoDocumento = pgEnum('tipo_documento', ['CNH', 'CRLV', 'COMPROVANTE_RESIDENCIA', 'FOTO']);
export const statusDocumento = pgEnum('status_documento', ['ENVIADO', 'ACEITO', 'RECUSADO']);
export const statusCredencial = pgEnum('status_credencial', ['ATIVA', 'SUSPENSA', 'REVOGADA', 'VENCIDA']);
export const tipoAtor = pgEnum('tipo_ator', ['ENTREGADOR', 'SERVIDOR', 'SISTEMA']);
export const resultadoConsulta = pgEnum('resultado_consulta', [
  'VALIDA', 'VENCIDA', 'SUSPENSA', 'REVOGADA', 'INVALIDA', 'NAO_ENCONTRADA',
]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

// ───────────── Servidores municipais (CTTU / Prefeitura) ─────────────
export const servidores = pgTable('servidores', {
  id: id(),
  nome: varchar('nome', { length: 120 }).notNull(),
  email: varchar('email', { length: 160 }).notNull(),
  matricula: varchar('matricula', { length: 30 }),
  senhaHash: text('senha_hash').notNull(),
  papel: papelServidor('papel').notNull(),
  orgao: varchar('orgao', { length: 60 }).notNull().default('CTTU'),
  ativo: boolean('ativo').notNull().default(true),
  ultimoAcessoEm: ts('ultimo_acesso_em'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [uniqueIndex('servidores_email_uk').on(t.email)]);

// ───────────── Entregadores ─────────────
export const entregadores = pgTable('entregadores', {
  id: id(),
  cpf: varchar('cpf', { length: 11 }).notNull(),
  nome: varchar('nome', { length: 120 }).notNull(),
  nomeSocial: varchar('nome_social', { length: 120 }),
  dataNascimento: date('data_nascimento', { mode: 'string' }),
  telefone: varchar('telefone', { length: 20 }).notNull(),
  email: varchar('email', { length: 160 }),
  senhaHash: text('senha_hash').notNull(),
  // Endereço / georreferenciamento (ponto base de trabalho ou residência)
  bairro: varchar('bairro', { length: 80 }),
  logradouro: varchar('logradouro', { length: 160 }),
  numero: varchar('numero', { length: 20 }),
  localizacao: geometry('localizacao', { type: 'point', mode: 'xy', srid: 4326 }),
  // Atividade
  tipoAtividade: tipoAtividade('tipo_atividade'),
  plataformas: text('plataformas').array().notNull().default(sql`'{}'::text[]`),
  // CNH
  cnhNumero: varchar('cnh_numero', { length: 11 }),
  cnhCategoria: varchar('cnh_categoria', { length: 3 }),
  cnhValidade: date('cnh_validade', { mode: 'string' }),
  // LGPD
  consentimentoEm: ts('consentimento_em').notNull(),
  consentimentoVersao: varchar('consentimento_versao', { length: 10 }).notNull(),
  anonimizadoEm: ts('anonimizado_em'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
  atualizadoEm: ts('atualizado_em').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('entregadores_cpf_uk').on(t.cpf),
  index('entregadores_bairro_idx').on(t.bairro),
  index('entregadores_localizacao_gix').using('gist', t.localizacao),
]);

export const motocicletas = pgTable('motocicletas', {
  id: id(),
  entregadorId: uuid('entregador_id').notNull().references(() => entregadores.id, { onDelete: 'cascade' }),
  placa: varchar('placa', { length: 7 }).notNull(),
  renavam: varchar('renavam', { length: 11 }),
  marca: varchar('marca', { length: 40 }).notNull(),
  modelo: varchar('modelo', { length: 60 }).notNull(),
  ano: smallint('ano').notNull(),
  cor: varchar('cor', { length: 30 }).notNull(),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('motocicletas_placa_uk').on(t.placa),
  uniqueIndex('motocicletas_entregador_uk').on(t.entregadorId),
]);

// ───────────── Solicitações de credenciamento ─────────────
export const solicitacoes = pgTable('solicitacoes', {
  id: id(),
  protocolo: varchar('protocolo', { length: 20 }).notNull(),
  entregadorId: uuid('entregador_id').notNull().references(() => entregadores.id, { onDelete: 'cascade' }),
  status: statusSolicitacao('status').notNull().default('RASCUNHO'),
  tipo: varchar('tipo', { length: 12 }).notNull().default('INICIAL'), // INICIAL | RENOVACAO
  enviadaEm: ts('enviada_em'),
  analiseIniciadaEm: ts('analise_iniciada_em'),
  decididaEm: ts('decidida_em'),
  analistaId: uuid('analista_id').references(() => servidores.id),
  motivo: text('motivo'),
  qtdPendencias: integer('qtd_pendencias').notNull().default(0),
  criadoEm: ts('criado_em').notNull().defaultNow(),
  atualizadoEm: ts('atualizado_em').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('solicitacoes_protocolo_uk').on(t.protocolo),
  index('solicitacoes_status_idx').on(t.status),
  index('solicitacoes_entregador_idx').on(t.entregadorId),
]);

export const solicitacaoEventos = pgTable('solicitacao_eventos', {
  id: id(),
  solicitacaoId: uuid('solicitacao_id').notNull().references(() => solicitacoes.id, { onDelete: 'cascade' }),
  status: statusSolicitacao('status').notNull(),
  mensagem: text('mensagem'),
  atorTipo: tipoAtor('ator_tipo').notNull(),
  atorId: uuid('ator_id'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [index('sol_eventos_sol_idx').on(t.solicitacaoId)]);

export const documentos = pgTable('documentos', {
  id: id(),
  entregadorId: uuid('entregador_id').notNull().references(() => entregadores.id, { onDelete: 'cascade' }),
  solicitacaoId: uuid('solicitacao_id').references(() => solicitacoes.id, { onDelete: 'set null' }),
  tipo: tipoDocumento('tipo').notNull(),
  caminho: text('caminho').notNull(),
  mime: varchar('mime', { length: 60 }).notNull(),
  tamanho: integer('tamanho').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  status: statusDocumento('status').notNull().default('ENVIADO'),
  motivoRecusa: text('motivo_recusa'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [index('documentos_sol_idx').on(t.solicitacaoId), index('documentos_ent_idx').on(t.entregadorId)]);

// ───────────── Credencial digital ─────────────
export const credenciais = pgTable('credenciais', {
  id: id(),
  numero: varchar('numero', { length: 16 }).notNull(),
  entregadorId: uuid('entregador_id').notNull().references(() => entregadores.id, { onDelete: 'cascade' }),
  solicitacaoId: uuid('solicitacao_id').notNull().references(() => solicitacoes.id),
  status: statusCredencial('status').notNull().default('ATIVA'),
  emitidaEm: ts('emitida_em').notNull().defaultNow(),
  validaAte: ts('valida_ate').notNull(),
  token: text('token').notNull(), // QR assinado (Ed25519)
  motivoStatus: text('motivo_status'),
  atualizadoEm: ts('atualizado_em').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('credenciais_numero_uk').on(t.numero),
  index('credenciais_entregador_idx').on(t.entregadorId),
  index('credenciais_status_idx').on(t.status),
]);

// ───────────── Consultas em campo (fiscalização) ─────────────
export const consultas = pgTable('consultas', {
  id: id(),
  idLocal: varchar('id_local', { length: 40 }).notNull(), // idempotência da sincronização offline
  credencialId: uuid('credencial_id').references(() => credenciais.id),
  numeroCredencial: varchar('numero_credencial', { length: 16 }),
  agenteId: uuid('agente_id').notNull().references(() => servidores.id),
  resultado: resultadoConsulta('resultado').notNull(),
  offline: boolean('offline').notNull().default(false),
  localizacao: geometry('localizacao', { type: 'point', mode: 'xy', srid: 4326 }),
  realizadaEm: ts('realizada_em').notNull(),
  sincronizadaEm: ts('sincronizada_em').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('consultas_id_local_uk').on(t.agenteId, t.idLocal),
  index('consultas_realizada_idx').on(t.realizadaEm),
]);

// ───────────── Notificações ao entregador ─────────────
export const notificacoes = pgTable('notificacoes', {
  id: id(),
  entregadorId: uuid('entregador_id').references(() => entregadores.id, { onDelete: 'cascade' }),
  titulo: varchar('titulo', { length: 120 }).notNull(),
  mensagem: text('mensagem').notNull(),
  tipo: varchar('tipo', { length: 20 }).notNull().default('INFO'), // INFO | PENDENCIA | APROVACAO | VENCIMENTO | COMUNICADO
  lidaEm: ts('lida_em'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [index('notificacoes_ent_idx').on(t.entregadorId)]);

// ───────────── Sessões (refresh tokens rotativos) ─────────────
export const sessoes = pgTable('sessoes', {
  id: id(),
  sujeitoTipo: tipoAtor('sujeito_tipo').notNull(),
  sujeitoId: uuid('sujeito_id').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiraEm: ts('expira_em').notNull(),
  revogadaEm: ts('revogada_em'),
  userAgent: text('user_agent'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [uniqueIndex('sessoes_hash_uk').on(t.tokenHash)]);

// ───────────── Trilha de auditoria (LGPD art. 37) ─────────────
export const auditoria = pgTable('auditoria', {
  id: id(),
  atorTipo: tipoAtor('ator_tipo').notNull(),
  atorId: uuid('ator_id'),
  acao: varchar('acao', { length: 60 }).notNull(),
  entidade: varchar('entidade', { length: 40 }).notNull(),
  entidadeId: uuid('entidade_id'),
  detalhes: jsonb('detalhes'),
  ip: varchar('ip', { length: 45 }),
  criadoEm: ts('criado_em').notNull().defaultNow(),
}, (t) => [index('auditoria_entidade_idx').on(t.entidade, t.entidadeId), index('auditoria_criado_idx').on(t.criadoEm)]);

// ───────────── Relações ─────────────
export const entregadoresRel = relations(entregadores, ({ one, many }) => ({
  motocicleta: one(motocicletas, { fields: [entregadores.id], references: [motocicletas.entregadorId] }),
  solicitacoes: many(solicitacoes),
  documentos: many(documentos),
  credenciais: many(credenciais),
}));
export const motocicletasRel = relations(motocicletas, ({ one }) => ({
  entregador: one(entregadores, { fields: [motocicletas.entregadorId], references: [entregadores.id] }),
}));
export const solicitacoesRel = relations(solicitacoes, ({ one, many }) => ({
  entregador: one(entregadores, { fields: [solicitacoes.entregadorId], references: [entregadores.id] }),
  analista: one(servidores, { fields: [solicitacoes.analistaId], references: [servidores.id] }),
  eventos: many(solicitacaoEventos),
  documentos: many(documentos),
}));
export const eventosRel = relations(solicitacaoEventos, ({ one }) => ({
  solicitacao: one(solicitacoes, { fields: [solicitacaoEventos.solicitacaoId], references: [solicitacoes.id] }),
}));
export const documentosRel = relations(documentos, ({ one }) => ({
  entregador: one(entregadores, { fields: [documentos.entregadorId], references: [entregadores.id] }),
  solicitacao: one(solicitacoes, { fields: [documentos.solicitacaoId], references: [solicitacoes.id] }),
}));
export const credenciaisRel = relations(credenciais, ({ one }) => ({
  entregador: one(entregadores, { fields: [credenciais.entregadorId], references: [entregadores.id] }),
}));
