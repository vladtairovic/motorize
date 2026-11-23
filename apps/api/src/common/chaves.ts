import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Par de chaves Ed25519 usado para assinar a credencial digital.
 * O agente de campo baixa só a chave pública e valida o QR Code sem internet
 * (mesmo princípio da CNH Digital / Carteira Digital de Trânsito).
 * Em produção, a chave privada fica em cofre (HSM / Vault) — aqui, em apps/api/keys.
 */
const DIR = path.join(__dirname, '..', '..', 'keys');
const PRIV = path.join(DIR, 'credencial-ed25519.pem');
const PUB = path.join(DIR, 'credencial-ed25519.pub.pem');

let cache: { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject; publicRaw: string; kid: string } | null = null;

export function garantirChaves() {
  if (cache) return cache;
  if (process.env.CREDENCIAL_PRIVATE_KEY_PEM) {
    const privateKey = crypto.createPrivateKey(process.env.CREDENCIAL_PRIVATE_KEY_PEM.replace(/\\n/g, '\n'));
    return (cache = montar(privateKey));
  }
  if (!fs.existsSync(PRIV)) {
    fs.mkdirSync(DIR, { recursive: true });
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));
    console.log('🔑 Novo par de chaves Ed25519 gerado em apps/api/keys');
  }
  return (cache = montar(crypto.createPrivateKey(fs.readFileSync(PRIV))));
}

function montar(privateKey: crypto.KeyObject) {
  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const kid = crypto.createHash('sha256').update(jwk.x).digest('hex').slice(0, 8);
  return { privateKey, publicKey, publicRaw: jwk.x, kid };
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Payload compacto para caber em QR de baixa densidade (leitura rápida em câmera ruim). */
export interface PayloadCredencial {
  v: 1;
  kid: string;
  n: string;   // número da credencial
  nm: string;  // nome de exibição
  cpf: string; // CPF mascarado (***.456.789-**)
  pl: string;  // placa
  at: string;  // tipo de atividade
  em: number;  // emitida em (epoch s)
  ex: number;  // válida até (epoch s)
}

export function assinarCredencial(p: Omit<PayloadCredencial, 'v' | 'kid'>): string {
  const { privateKey, kid } = garantirChaves();
  const corpo = b64u(JSON.stringify({ v: 1, kid, ...p }));
  const assinatura = crypto.sign(null, Buffer.from(corpo), privateKey);
  return `MTZ1.${corpo}.${b64u(assinatura)}`;
}

export function verificarCredencial(token: string): PayloadCredencial | null {
  const partes = token.trim().split('.');
  if (partes.length !== 3 || partes[0] !== 'MTZ1') return null;
  const { publicKey } = garantirChaves();
  const ok = crypto.verify(null, Buffer.from(partes[1]), publicKey, Buffer.from(partes[2], 'base64url'));
  if (!ok) return null;
  try { return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')); } catch { return null; }
}
