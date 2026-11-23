/**
 * Cliente HTTP com renovação automática de sessão (refresh token rotativo).
 * Entregador e agente têm sessões separadas no mesmo aparelho.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

export type Perfil = 'entregador' | 'agente';
export interface Sessao {
  accessToken: string;
  refreshToken: string;
  usuario: { sub: string; tipo: string; nome?: string; papel?: string };
}

const chave = (p: Perfil) => `motorize.sessao.${p}`;
export const sessao = {
  ler(p: Perfil): Sessao | null {
    try {
      return JSON.parse(localStorage.getItem(chave(p)) ?? 'null');
    } catch {
      return null;
    }
  },
  salvar(p: Perfil, s: Sessao) {
    localStorage.setItem(chave(p), JSON.stringify(s));
    window.dispatchEvent(new Event('motorize:sessao'));
  },
  limpar(p: Perfil) {
    localStorage.removeItem(chave(p));
    window.dispatchEvent(new Event('motorize:sessao'));
  },
};

export class ErroApi extends Error {
  constructor(public status: number, message: string, public campos?: { campo: string; erro: string }[]) {
    super(message);
  }
}

async function lerErro(r: Response) {
  let corpo: any = null;
  try {
    corpo = await r.json();
  } catch {
    /* sem corpo */
  }
  const msg = corpo?.mensagem ?? (Array.isArray(corpo?.message) ? corpo.message.join(', ') : corpo?.message) ?? 'Não foi possível concluir. Tente de novo.';
  return new ErroApi(r.status, msg, corpo?.campos);
}

const renovando: Partial<Record<Perfil, Promise<boolean>>> = {};
async function renovar(p: Perfil): Promise<boolean> {
  const s = sessao.ler(p);
  if (!s) return false;
  renovando[p] ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) {
        if (r.status === 401) sessao.limpar(p);
        return false;
      }
      sessao.salvar(p, await r.json());
      return true;
    })
    .catch(() => false)
    .finally(() => delete renovando[p]);
  return renovando[p]!;
}

export async function api<T = any>(caminho: string, opcoes: RequestInit & { perfil?: Perfil; json?: unknown } = {}): Promise<T> {
  const { perfil, json, ...init } = opcoes;
  const fazer = () => {
    const headers = new Headers(init.headers);
    if (json !== undefined) headers.set('Content-Type', 'application/json');
    const s = perfil ? sessao.ler(perfil) : null;
    if (s) headers.set('Authorization', `Bearer ${s.accessToken}`);
    return fetch(`${API_URL}${caminho}`, { ...init, headers, body: json !== undefined ? JSON.stringify(json) : init.body });
  };
  let r: Response;
  try {
    r = await fazer();
  } catch {
    throw new ErroApi(0, 'Sem conexão com a internet. Tente de novo quando tiver sinal.');
  }
  if (r.status === 401 && perfil && (await renovar(perfil))) r = await fazer();
  if (!r.ok) throw await lerErro(r);
  if (r.status === 204) return undefined as T;
  return r.json();
}

export async function sair(p: Perfil) {
  const s = sessao.ler(p);
  sessao.limpar(p);
  if (s) fetch(`${API_URL}/auth/sair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => {});
}

export async function enviarArquivo(caminho: string, arquivo: Blob, nome: string) {
  const fd = new FormData();
  fd.append('arquivo', arquivo, nome);
  return api(caminho, { method: 'POST', body: fd, perfil: 'entregador' });
}

/** Busca arquivo autenticado e devolve URL local (para pré-visualizar documento). */
export async function urlArquivo(caminho: string, perfil: Perfil) {
  const s = sessao.ler(perfil);
  const r = await fetch(`${API_URL}${caminho}`, { headers: s ? { Authorization: `Bearer ${s.accessToken}` } : {} });
  if (!r.ok) throw await lerErro(r);
  return URL.createObjectURL(await r.blob());
}
