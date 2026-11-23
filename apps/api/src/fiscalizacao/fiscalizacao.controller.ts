import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { Sql } from 'postgres';
import { SQL } from '../db/db.module';
import { CredencialService } from '../credencial/credencial.service';
import { SomenteServidor, Usuario, Sujeito } from '../auth/auth.guard';
import { ZodPipe } from '../common/util';
import { AuditoriaService } from '../common/auditoria.service';

const validar = z.object({
  token: z.string().min(10).max(2000),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  idLocal: z.string().max(40).optional(),
});
const sync = z.object({
  consultas: z
    .array(
      z.object({
        idLocal: z.string().min(4).max(40),
        numero: z.string().max(16).nullable(),
        resultado: z.enum(['VALIDA', 'VENCIDA', 'SUSPENSA', 'REVOGADA', 'INVALIDA', 'NAO_ENCONTRADA']),
        realizadaEm: z.coerce.date(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      }),
    )
    .max(500),
});

/**
 * Operação em campo (Agente da CTTU).
 * O "pacote offline" contém a chave pública + a lista de credenciais emitidas
 * (com foto reduzida), permitindo validar QR Codes sem sinal.
 */
@Controller('fiscalizacao')
@SomenteServidor('AGENTE')
export class FiscalizacaoController {
  constructor(private cred: CredencialService, @Inject(SQL) private sql: Sql, private auditoria: AuditoriaService) {}

  @Get('pacote')
  async pacote(@Usuario() u: Sujeito) {
    const credenciais = await this.sql`
      SELECT c.numero, c.status, c.valida_ate, e.id AS entregador_id,
             COALESCE(e.nome_social, e.nome) AS nome, m.placa, m.modelo, m.cor, e.tipo_atividade,
             (SELECT 'data:' || d.mime || ';base64,' || d.caminho FROM documentos d
               WHERE d.entregador_id = e.id AND d.tipo = 'FOTO' AND d.status = 'ACEITO' ORDER BY d.criado_em DESC LIMIT 1) AS foto_ref
      FROM credenciais c
      JOIN entregadores e ON e.id = c.entregador_id
      LEFT JOIN motocicletas m ON m.entregador_id = e.id
      WHERE c.status <> 'REVOGADA' OR c.atualizado_em > now() - interval '180 days'`;
    const itens = await Promise.all(
      credenciais.map(async ({ foto_ref, entregador_id, ...c }) => ({ ...c, foto: foto_ref ? await this.cred.foto(entregador_id) : null })),
    );
    await this.auditoria.registrar(u, 'BAIXOU_PACOTE_OFFLINE', 'credencial', null, { itens: itens.length });
    return { geradoEm: new Date(), chave: this.cred.chavePublica(), credenciais: itens };
  }

  @Post('validar')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async validar(@Body(new ZodPipe(validar)) d: z.infer<typeof validar>, @Usuario() u: Sujeito) {
    const r = await this.cred.validarToken(d.token);
    const idLocal = d.idLocal ?? `on-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.sql`
      INSERT INTO consultas (id_local, credencial_id, numero_credencial, agente_id, resultado, offline, localizacao, realizada_em)
      VALUES (${idLocal}, ${r.credencial?.id ?? null}, ${r.payload?.n ?? null}, ${u.sub}, ${r.resultado}, false,
              ${d.latitude != null && d.longitude != null ? this.sql`ST_SetSRID(ST_MakePoint(${d.longitude}, ${d.latitude}), 4326)` : null},
              now())
      ON CONFLICT (agente_id, id_local) DO NOTHING`;
    const c = r.credencial;
    return {
      resultado: r.resultado,
      credencial: c
        ? {
            numero: c.numero, status: c.status, validaAte: c.validaAte, motivoStatus: c.motivoStatus,
            nome: c.entregador.nomeSocial || c.entregador.nome,
            placa: c.entregador.motocicleta?.placa, modelo: c.entregador.motocicleta?.modelo, cor: c.entregador.motocicleta?.cor,
            foto: await this.cred.foto(c.entregador.id),
          }
        : null,
    };
  }

  /** Sobe as consultas feitas sem sinal. Idempotente por (agente, idLocal). */
  @Post('consultas/sync')
  @HttpCode(200)
  async sincronizar(@Body(new ZodPipe(sync)) d: z.infer<typeof sync>, @Usuario() u: Sujeito) {
    let gravadas = 0;
    for (const c of d.consultas) {
      const r = await this.sql`
        INSERT INTO consultas (id_local, credencial_id, numero_credencial, agente_id, resultado, offline, localizacao, realizada_em)
        VALUES (${c.idLocal}, (SELECT id FROM credenciais WHERE numero = ${c.numero}), ${c.numero}, ${u.sub}, ${c.resultado}, true,
                ${c.latitude != null && c.longitude != null ? this.sql`ST_SetSRID(ST_MakePoint(${c.longitude}, ${c.latitude}), 4326)` : null},
                ${c.realizadaEm.toISOString()}::timestamptz)
        ON CONFLICT (agente_id, id_local) DO NOTHING`;
      gravadas += r.count;
    }
    return { recebidas: d.consultas.length, gravadas, ids: d.consultas.map((c) => c.idLocal) };
  }
}
