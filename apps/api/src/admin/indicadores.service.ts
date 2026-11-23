import { Inject, Injectable } from '@nestjs/common';
import type { Sql } from 'postgres';
import { SQL } from '../db/db.module';

/** Métricas-chave do Lean Canvas: adesão, conclusão, eficiência, retrabalho, retenção. */
@Injectable()
export class IndicadoresService {
  constructor(@Inject(SQL) private sql: Sql) {}

  async resumo() {
    const meta = Number(process.env.META_ENTREGADORES ?? 300);
    const [k] = await this.sql`
      WITH ult AS (
        SELECT DISTINCT ON (entregador_id) * FROM solicitacoes ORDER BY entregador_id, criado_em DESC
      )
      SELECT
        (SELECT count(*) FROM entregadores WHERE anonimizado_em IS NULL)::int AS contas,
        (SELECT count(*) FROM ult WHERE status <> 'RASCUNHO')::int AS enviadas,
        (SELECT count(*) FROM ult)::int AS iniciadas,
        (SELECT count(*) FROM credenciais WHERE status = 'ATIVA' AND valida_ate >= now())::int AS credenciados,
        (SELECT count(*) FROM ult WHERE status = 'ENVIADA')::int AS fila,
        (SELECT count(*) FROM ult WHERE status = 'EM_ANALISE')::int AS em_analise,
        (SELECT count(*) FROM ult WHERE status = 'PENDENCIA')::int AS pendencia,
        (SELECT count(*) FROM ult WHERE status = 'REPROVADA')::int AS reprovadas,
        (SELECT round(avg(extract(epoch FROM decidida_em - enviada_em)) / 3600.0, 1)
           FROM solicitacoes WHERE decidida_em IS NOT NULL AND enviada_em IS NOT NULL AND status = 'APROVADA') AS horas_ate_decisao,
        (SELECT round(100.0 * count(*) FILTER (WHERE qtd_pendencias > 0) / NULLIF(count(*), 0), 1)
           FROM solicitacoes WHERE status IN ('APROVADA','REPROVADA','PENDENCIA')) AS retrabalho_pct,
        (SELECT count(*) FROM credenciais WHERE status = 'ATIVA' AND valida_ate BETWEEN now() AND now() + interval '30 days')::int AS vencendo_30d,
        (SELECT count(*) FROM credenciais WHERE status = 'VENCIDA' OR (status = 'ATIVA' AND valida_ate < now()))::int AS vencidas,
        (SELECT count(*) FROM consultas WHERE realizada_em >= now() - interval '30 days')::int AS consultas_30d,
        (SELECT count(*) FROM consultas WHERE realizada_em >= now() - interval '30 days' AND resultado <> 'VALIDA')::int AS consultas_irregulares_30d,
        (SELECT round(100.0 * count(*) FILTER (WHERE offline) / NULLIF(count(*), 0), 0) FROM consultas WHERE realizada_em >= now() - interval '30 days') AS consultas_offline_pct
    `;
    // Retenção: das credenciais que venceram, quantas foram renovadas
    const [ret] = await this.sql`
      SELECT round(100.0 * count(*) FILTER (WHERE renovou) / NULLIF(count(*), 0), 1) AS retencao_pct FROM (
        SELECT EXISTS (SELECT 1 FROM credenciais c2 WHERE c2.entregador_id = c.entregador_id AND c2.emitida_em > c.emitida_em) AS renovou
        FROM credenciais c WHERE c.valida_ate < now() OR c.status = 'VENCIDA'
      ) x`;
    return {
      meta,
      ...k,
      adesao_pct: Math.round((1000 * k.credenciados) / meta) / 10,
      conclusao_pct: k.iniciadas ? Math.round((1000 * k.enviadas) / k.iniciadas) / 10 : null,
      retencao_pct: ret.retencao_pct,
    };
  }

  porBairro() {
    return this.sql`
      SELECT COALESCE(e.bairro, 'Não informado') AS bairro,
             count(*)::int AS cadastrados,
             count(c.id) FILTER (WHERE c.status = 'ATIVA' AND c.valida_ate >= now())::int AS credenciados
      FROM entregadores e
      LEFT JOIN credenciais c ON c.entregador_id = e.id
      WHERE e.anonimizado_em IS NULL
      GROUP BY 1 ORDER BY cadastrados DESC`;
  }

  porAtividade() {
    return this.sql`
      SELECT COALESCE(tipo_atividade::text, 'NAO_INFORMADO') AS atividade, count(*)::int AS total
      FROM entregadores WHERE anonimizado_em IS NULL GROUP BY 1 ORDER BY total DESC`;
  }

  plataformas() {
    return this.sql`
      SELECT p AS plataforma, count(*)::int AS total
      FROM entregadores, unnest(plataformas) p WHERE anonimizado_em IS NULL GROUP BY 1 ORDER BY total DESC`;
  }

  evolucao() {
    return this.sql`
      WITH semanas AS (
        SELECT generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS semana
      )
      SELECT to_char(s.semana, 'DD/MM') AS semana,
             (SELECT count(*) FROM solicitacoes WHERE enviada_em >= s.semana AND enviada_em < s.semana + interval '1 week')::int AS enviadas,
             (SELECT count(*) FROM credenciais WHERE emitida_em >= s.semana AND emitida_em < s.semana + interval '1 week')::int AS aprovadas
      FROM semanas s ORDER BY s.semana`;
  }

  /**
   * Mapa de concentração com privacidade: pontos agregados em grade de ~250 m (PostGIS),
   * nunca a posição individual. Células com menos de 3 pessoas são omitidas (k-anonimato).
   */
  mapa() {
    return this.sql`
      SELECT ST_Y(ST_Centroid(ST_Collect(localizacao))) AS lat,
             ST_X(ST_Centroid(ST_Collect(localizacao))) AS lng,
             count(*)::int AS total
      FROM entregadores
      WHERE localizacao IS NOT NULL AND anonimizado_em IS NULL
      GROUP BY ST_SnapToGrid(localizacao, 0.0025)
      HAVING count(*) >= 3`;
  }

  consultasRecentes() {
    return this.sql`
      SELECT c.id, c.realizada_em, c.resultado, c.offline, c.numero_credencial, s.nome AS agente, e.nome AS entregador
      FROM consultas c
      JOIN servidores s ON s.id = c.agente_id
      LEFT JOIN credenciais cr ON cr.id = c.credencial_id
      LEFT JOIN entregadores e ON e.id = cr.entregador_id
      ORDER BY c.realizada_em DESC LIMIT 15`;
  }

  async csvEntregadores() {
    const rows = await this.sql`
      SELECT e.nome, e.bairro, e.tipo_atividade, array_to_string(e.plataformas, '|') AS plataformas,
             m.placa, m.modelo, m.ano, c.numero AS credencial, c.status AS credencial_status,
             to_char(c.valida_ate, 'YYYY-MM-DD') AS valida_ate, to_char(e.criado_em, 'YYYY-MM-DD') AS cadastrado_em
      FROM entregadores e
      LEFT JOIN motocicletas m ON m.entregador_id = e.id
      LEFT JOIN LATERAL (SELECT * FROM credenciais WHERE entregador_id = e.id ORDER BY emitida_em DESC LIMIT 1) c ON true
      WHERE e.anonimizado_em IS NULL ORDER BY e.nome`;
    const cols = ['nome', 'bairro', 'tipo_atividade', 'plataformas', 'placa', 'modelo', 'ano', 'credencial', 'credencial_status', 'valida_ate', 'cadastrado_em'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // CPF e telefone ficam fora do relatório (minimização — LGPD art. 6º, III)
    return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
  }
}
