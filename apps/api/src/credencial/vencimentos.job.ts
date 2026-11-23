import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Sql } from 'postgres';
import { SQL } from '../db/db.module';

/** Rotina diária: marca vencidas e avisa 30 e 7 dias antes do vencimento. */
@Injectable()
export class VencimentosJob implements OnApplicationBootstrap {
  private log = new Logger('Vencimentos');
  constructor(@Inject(SQL) private sql: Sql) {}

  onApplicationBootstrap() {
    this.executar().catch((e) => this.log.error(e.message));
  }

  @Cron('0 6 * * *', { timeZone: 'America/Recife' })
  async executar() {
    const vencidas = await this.sql`
      UPDATE credenciais SET status = 'VENCIDA', atualizado_em = now()
      WHERE status = 'ATIVA' AND valida_ate < now() RETURNING entregador_id, numero`;
    for (const v of vencidas) {
      await this.sql`INSERT INTO notificacoes (entregador_id, titulo, mensagem, tipo)
        VALUES (${v.entregador_id}, 'Credencial vencida', ${`A credencial ${v.numero} venceu. Abra o app e faça a renovação.`}, 'VENCIMENTO')`;
    }
    for (const dias of [30, 7]) {
      await this.sql`
        INSERT INTO notificacoes (entregador_id, titulo, mensagem, tipo)
        SELECT c.entregador_id, ${`Sua credencial vence em ${dias} dias`},
               'Renove pelo app para continuar credenciado. É rápido: basta revisar seus dados e documentos.', 'VENCIMENTO'
        FROM credenciais c
        WHERE c.status = 'ATIVA' AND c.valida_ate::date = (now() + make_interval(days => ${dias}))::date
          AND NOT EXISTS (SELECT 1 FROM notificacoes n WHERE n.entregador_id = c.entregador_id
                          AND n.titulo = ${`Sua credencial vence em ${dias} dias`} AND n.criado_em > now() - interval '2 days')`;
    }
    if (vencidas.length) this.log.log(`${vencidas.length} credencial(is) marcada(s) como vencida(s)`);
  }
}
