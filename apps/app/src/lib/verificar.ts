import * as ed from '@noble/ed25519';
import { api } from './api';
import { meta } from './offline';

export interface PayloadCredencial {
  v: 1;
  kid: string;
  n: string;
  nm: string;
  cpf: string;
  pl: string;
  at: string;
  em: number;
  ex: number;
}

const b64uParaBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** Chave pública da Prefeitura: baixada uma vez e guardada para uso sem sinal. */
export async function obterChave(): Promise<{ kid: string; x: string } | null> {
  try {
    const c = await api<{ kid: string; x: string }>('/publico/chave');
    await meta.salvar('chave', c);
    return c;
  } catch {
    return (await meta.ler<{ kid: string; x: string }>('chave')) ?? null;
  }
}

/**
 * Verifica a assinatura Ed25519 do QR Code localmente — não precisa de internet.
 * Retorna o payload se autêntico, ou null se adulterado/inválido.
 */
export async function verificarOffline(token: string, chave: { kid: string; x: string }): Promise<PayloadCredencial | null> {
  const partes = token.trim().split('.');
  if (partes.length !== 3 || partes[0] !== 'MTZ1') return null;
  try {
    const ok = await ed.verifyAsync(b64uParaBytes(partes[2]), new TextEncoder().encode(partes[1]), b64uParaBytes(chave.x));
    if (!ok) return null;
    const p: PayloadCredencial = JSON.parse(new TextDecoder().decode(b64uParaBytes(partes[1])));
    if (p.kid !== chave.kid) return null;
    return p;
  } catch {
    return null;
  }
}
