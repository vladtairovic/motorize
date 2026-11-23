import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { criarConexao, Db } from './client';

export const DB = Symbol('DB');
export const SQL = Symbol('SQL');
export const InjectDb = () => Inject(DB);

const conexao = criarConexao();

@Global()
@Module({
  providers: [
    { provide: DB, useValue: conexao.db },
    { provide: SQL, useValue: conexao.sql },
  ],
  exports: [DB, SQL],
})
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await conexao.sql.end({ timeout: 5 });
  }
}

export type { Db };
