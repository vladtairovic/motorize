import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { criarConexao } from './client';

async function main() {
  const { db, sql } = criarConexao();
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', '..', 'drizzle') });
  await sql`CREATE SEQUENCE IF NOT EXISTS protocolo_seq START 1`;
  await sql`CREATE SEQUENCE IF NOT EXISTS credencial_seq START 1`;
  console.log('✔ Migrações aplicadas');
  await sql.end();
}

main().catch((e) => {
  console.error('✖ Falha na migração:', e.message);
  process.exit(1);
});
