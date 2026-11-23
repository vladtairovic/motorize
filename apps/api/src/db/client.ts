import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export function criarConexao(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL não definida. Copie apps/api/.env.example para apps/api/.env');
  const sqlClient = postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
  return { sql: sqlClient, db: drizzle(sqlClient, { schema, casing: undefined }) };
}

export type Db = ReturnType<typeof criarConexao>['db'];
export { schema };
