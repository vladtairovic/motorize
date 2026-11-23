import { Global, Injectable, Module } from '@nestjs/common';
import { InjectDb, Db } from '../db/db.module';
import { auditoria } from '../db/schema';
import type { Sujeito } from '../auth/auth.guard';

/** Registra quem acessou/alterou dado pessoal — exigência de rastreabilidade da LGPD. */
@Injectable()
export class AuditoriaService {
  constructor(@InjectDb() private db: Db) {}

  async registrar(
    ator: Sujeito | null,
    acao: string,
    entidade: string,
    entidadeId?: string | null,
    detalhes?: Record<string, unknown>,
    ip?: string,
  ) {
    await this.db.insert(auditoria).values({
      atorTipo: ator ? ator.tipo : 'SISTEMA',
      atorId: ator?.sub ?? null,
      acao,
      entidade,
      entidadeId: entidadeId ?? null,
      detalhes: detalhes ?? null,
      ip: ip ?? null,
    });
  }
}

@Global()
@Module({ providers: [AuditoriaService], exports: [AuditoriaService] })
export class AuditoriaModule {}
