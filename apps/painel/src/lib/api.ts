export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
const CHAVE = 'motorize.painel.sessao';

export interface Usuario { sub: string; tipo: string; nome: string; papel: 'ADMIN' | 'ANALISTA' | 'AGENTE' | 'GESTOR' }
export interface Sessao { accessToken: string; refreshToken: string; usuario: Usuario }

export const sessao = {
  ler(): Sessao | null {
    try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null'); } catch { return null; }
  },
  salvar(s: Sessao) { localStorage.setItem(CHAVE, JSON.stringify(s)); window.dispatchEvent(new Event('motorize:sessao')); },
  limpar() { localStorage.removeItem(CHAVE); window.dispatchEvent(new Event('motorize:sessao')); },
};

export class ErroApi extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let renovando: Promise<boolean> | null = null;
function renovar() {
  const s = sessao.ler();
  if (!s) return Promise.resolve(false);
  renovando ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => { if (!r.ok) { sessao.limpar(); return false; } sessao.salvar(await r.json()); return true; })
    .catch(() => false)
    .finally(() => (renovando = null));
  return renovando;
}

async function requisitar(caminho: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...resto } = init;
  const fazer = () => {
    const h = new Headers(resto.headers);
    if (json !== undefined) h.set('Content-Type', 'application/json');
    const s = sessao.ler();
    if (s) h.set('Authorization', `Bearer ${s.accessToken}`);
    return fetch(`${API_URL}${caminho}`, { ...resto, headers: h, body: json !== undefined ? JSON.stringify(json) : resto.body });
  };
  let r: Response;
  try { r = await fazer(); } catch { throw new ErroApi(0, 'Sem conexão com o servidor.'); }
  if (r.status === 401 && (await renovar())) r = await fazer();
  if (!r.ok) {
    let c: any = null;
    try { c = await r.json(); } catch { /* */ }
    const msg = c?.campos?.length ? c.campos.map((x: any) => x.erro).join('; ') : c?.mensagem ?? c?.message ?? 'Erro ao processar a solicitação.';
    throw new ErroApi(r.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return r;
}

export async function api<T = any>(caminho: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const r = await requisitar(caminho, init);
  return r.status === 204 ? (undefined as T) : r.json();
}

export async function baixar(caminho: string) {
  const r = await requisitar(caminho);
  return r.blob();
}

export async function sair() {
  const s = sessao.ler();
  sessao.limpar();
  if (s) fetch(`${API_URL}/auth/sair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => {});
}
