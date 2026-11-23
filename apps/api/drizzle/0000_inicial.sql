CREATE TYPE "public"."papel_servidor" AS ENUM('ADMIN', 'ANALISTA', 'AGENTE', 'GESTOR');--> statement-breakpoint
CREATE TYPE "public"."resultado_consulta" AS ENUM('VALIDA', 'VENCIDA', 'SUSPENSA', 'REVOGADA', 'INVALIDA', 'NAO_ENCONTRADA');--> statement-breakpoint
CREATE TYPE "public"."status_credencial" AS ENUM('ATIVA', 'SUSPENSA', 'REVOGADA', 'VENCIDA');--> statement-breakpoint
CREATE TYPE "public"."status_documento" AS ENUM('ENVIADO', 'ACEITO', 'RECUSADO');--> statement-breakpoint
CREATE TYPE "public"."status_solicitacao" AS ENUM('RASCUNHO', 'ENVIADA', 'EM_ANALISE', 'PENDENCIA', 'APROVADA', 'REPROVADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_atividade" AS ENUM('APP_DELIVERY', 'MOTOFRETE', 'MOTOTAXI', 'AUTONOMO');--> statement-breakpoint
CREATE TYPE "public"."tipo_ator" AS ENUM('ENTREGADOR', 'SERVIDOR', 'SISTEMA');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('CNH', 'CRLV', 'COMPROVANTE_RESIDENCIA', 'FOTO');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ator_tipo" "tipo_ator" NOT NULL,
	"ator_id" uuid,
	"acao" varchar(60) NOT NULL,
	"entidade" varchar(40) NOT NULL,
	"entidade_id" uuid,
	"detalhes" jsonb,
	"ip" varchar(45),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_local" varchar(40) NOT NULL,
	"credencial_id" uuid,
	"numero_credencial" varchar(16),
	"agente_id" uuid NOT NULL,
	"resultado" "resultado_consulta" NOT NULL,
	"offline" boolean DEFAULT false NOT NULL,
	"localizacao" geometry(point),
	"realizada_em" timestamp with time zone NOT NULL,
	"sincronizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credenciais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" varchar(16) NOT NULL,
	"entregador_id" uuid NOT NULL,
	"solicitacao_id" uuid NOT NULL,
	"status" "status_credencial" DEFAULT 'ATIVA' NOT NULL,
	"emitida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"valida_ate" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"motivo_status" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entregador_id" uuid NOT NULL,
	"solicitacao_id" uuid,
	"tipo" "tipo_documento" NOT NULL,
	"caminho" text NOT NULL,
	"mime" varchar(60) NOT NULL,
	"tamanho" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"status" "status_documento" DEFAULT 'ENVIADO' NOT NULL,
	"motivo_recusa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entregadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"nome" varchar(120) NOT NULL,
	"nome_social" varchar(120),
	"data_nascimento" date,
	"telefone" varchar(20) NOT NULL,
	"email" varchar(160),
	"senha_hash" text NOT NULL,
	"bairro" varchar(80),
	"logradouro" varchar(160),
	"numero" varchar(20),
	"localizacao" geometry(point),
	"tipo_atividade" "tipo_atividade",
	"plataformas" text[] DEFAULT '{}'::text[] NOT NULL,
	"cnh_numero" varchar(11),
	"cnh_categoria" varchar(3),
	"cnh_validade" date,
	"consentimento_em" timestamp with time zone NOT NULL,
	"consentimento_versao" varchar(10) NOT NULL,
	"anonimizado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motocicletas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entregador_id" uuid NOT NULL,
	"placa" varchar(7) NOT NULL,
	"renavam" varchar(11),
	"marca" varchar(40) NOT NULL,
	"modelo" varchar(60) NOT NULL,
	"ano" smallint NOT NULL,
	"cor" varchar(30) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entregador_id" uuid,
	"titulo" varchar(120) NOT NULL,
	"mensagem" text NOT NULL,
	"tipo" varchar(20) DEFAULT 'INFO' NOT NULL,
	"lida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servidores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"matricula" varchar(30),
	"senha_hash" text NOT NULL,
	"papel" "papel_servidor" NOT NULL,
	"orgao" varchar(60) DEFAULT 'CTTU' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sujeito_tipo" "tipo_ator" NOT NULL,
	"sujeito_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogada_em" timestamp with time zone,
	"user_agent" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacao_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitacao_id" uuid NOT NULL,
	"status" "status_solicitacao" NOT NULL,
	"mensagem" text,
	"ator_tipo" "tipo_ator" NOT NULL,
	"ator_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocolo" varchar(20) NOT NULL,
	"entregador_id" uuid NOT NULL,
	"status" "status_solicitacao" DEFAULT 'RASCUNHO' NOT NULL,
	"tipo" varchar(12) DEFAULT 'INICIAL' NOT NULL,
	"enviada_em" timestamp with time zone,
	"analise_iniciada_em" timestamp with time zone,
	"decidida_em" timestamp with time zone,
	"analista_id" uuid,
	"motivo" text,
	"qtd_pendencias" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_credencial_id_credenciais_id_fk" FOREIGN KEY ("credencial_id") REFERENCES "public"."credenciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_agente_id_servidores_id_fk" FOREIGN KEY ("agente_id") REFERENCES "public"."servidores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credenciais" ADD CONSTRAINT "credenciais_entregador_id_entregadores_id_fk" FOREIGN KEY ("entregador_id") REFERENCES "public"."entregadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credenciais" ADD CONSTRAINT "credenciais_solicitacao_id_solicitacoes_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_entregador_id_entregadores_id_fk" FOREIGN KEY ("entregador_id") REFERENCES "public"."entregadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_solicitacao_id_solicitacoes_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motocicletas" ADD CONSTRAINT "motocicletas_entregador_id_entregadores_id_fk" FOREIGN KEY ("entregador_id") REFERENCES "public"."entregadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_entregador_id_entregadores_id_fk" FOREIGN KEY ("entregador_id") REFERENCES "public"."entregadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_eventos" ADD CONSTRAINT "solicitacao_eventos_solicitacao_id_solicitacoes_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_entregador_id_entregadores_id_fk" FOREIGN KEY ("entregador_id") REFERENCES "public"."entregadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_analista_id_servidores_id_fk" FOREIGN KEY ("analista_id") REFERENCES "public"."servidores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_criado_idx" ON "auditoria" USING btree ("criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "consultas_id_local_uk" ON "consultas" USING btree ("agente_id","id_local");--> statement-breakpoint
CREATE INDEX "consultas_realizada_idx" ON "consultas" USING btree ("realizada_em");--> statement-breakpoint
CREATE UNIQUE INDEX "credenciais_numero_uk" ON "credenciais" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "credenciais_entregador_idx" ON "credenciais" USING btree ("entregador_id");--> statement-breakpoint
CREATE INDEX "credenciais_status_idx" ON "credenciais" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documentos_sol_idx" ON "documentos" USING btree ("solicitacao_id");--> statement-breakpoint
CREATE INDEX "documentos_ent_idx" ON "documentos" USING btree ("entregador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entregadores_cpf_uk" ON "entregadores" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "entregadores_bairro_idx" ON "entregadores" USING btree ("bairro");--> statement-breakpoint
CREATE INDEX "entregadores_localizacao_gix" ON "entregadores" USING gist ("localizacao");--> statement-breakpoint
CREATE UNIQUE INDEX "motocicletas_placa_uk" ON "motocicletas" USING btree ("placa");--> statement-breakpoint
CREATE UNIQUE INDEX "motocicletas_entregador_uk" ON "motocicletas" USING btree ("entregador_id");--> statement-breakpoint
CREATE INDEX "notificacoes_ent_idx" ON "notificacoes" USING btree ("entregador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "servidores_email_uk" ON "servidores" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessoes_hash_uk" ON "sessoes" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sol_eventos_sol_idx" ON "solicitacao_eventos" USING btree ("solicitacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitacoes_protocolo_uk" ON "solicitacoes" USING btree ("protocolo");--> statement-breakpoint
CREATE INDEX "solicitacoes_status_idx" ON "solicitacoes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "solicitacoes_entregador_idx" ON "solicitacoes" USING btree ("entregador_id");