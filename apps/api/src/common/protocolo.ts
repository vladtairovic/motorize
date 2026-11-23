import type { Sql } from 'postgres';

export async function novoProtocolo(sql: Sql) {
  const [{ n }] = await sql<{ n: string }[]>`SELECT nextval('protocolo_seq') AS n`;
  return `MTZ-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`;
}

export async function novoNumeroCredencial(sql: Sql) {
  const [{ n }] = await sql<{ n: string }[]>`SELECT nextval('credencial_seq') AS n`;
  return `TOR-${String(n).padStart(5, '0')}`;
}
