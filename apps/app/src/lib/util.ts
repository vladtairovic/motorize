export const ATIVIDADES: Record<string, string> = {
  APP_DELIVERY: 'Entregas por aplicativo',
  MOTOFRETE: 'Motofrete (empresa ou comércio)',
  MOTOTAXI: 'Mototáxi',
  AUTONOMO: 'Entregador autônomo',
};

export const DOCS: Record<string, { nome: string; dica: string }> = {
  CNH: { nome: 'CNH', dica: 'Foto da CNH aberta, frente e verso visíveis. Vale a CNH digital em PDF.' },
  CRLV: { nome: 'Documento da moto (CRLV)', dica: 'O CRLV-e em PDF baixado do app Carteira Digital de Trânsito, ou foto nítida.' },
  COMPROVANTE_RESIDENCIA: { nome: 'Comprovante de residência', dica: 'Conta de água, luz ou telefone dos últimos 3 meses.' },
  FOTO: { nome: 'Sua foto', dica: 'Rosto de frente, sem capacete e sem óculos escuros, em lugar claro. Vai aparecer na credencial.' },
};

export const STATUS_SOL: Record<string, { rotulo: string; tom: 'neutro' | 'info' | 'alerta' | 'ok' | 'erro' }> = {
  RASCUNHO: { rotulo: 'Em preenchimento', tom: 'neutro' },
  ENVIADA: { rotulo: 'Enviada, aguardando análise', tom: 'info' },
  EM_ANALISE: { rotulo: 'Em análise na CTTU', tom: 'info' },
  PENDENCIA: { rotulo: 'Precisa de correção', tom: 'alerta' },
  APROVADA: { rotulo: 'Aprovada', tom: 'ok' },
  REPROVADA: { rotulo: 'Não aprovada', tom: 'erro' },
};

export const RESULTADO: Record<string, { titulo: string; tom: 'ok' | 'alerta' | 'erro' }> = {
  VALIDA: { titulo: 'Credencial válida', tom: 'ok' },
  VENCIDA: { titulo: 'Credencial vencida', tom: 'alerta' },
  SUSPENSA: { titulo: 'Credencial suspensa', tom: 'erro' },
  REVOGADA: { titulo: 'Credencial revogada', tom: 'erro' },
  INVALIDA: { titulo: 'QR Code não é autêntico', tom: 'erro' },
  NAO_ENCONTRADA: { titulo: 'Credencial não encontrada', tom: 'erro' },
};

export const dataBR = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Recife' }) : '—');
export const dataHoraBR = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' }) : '—';

export const mascaraCpf = (v: string) =>
  v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
export const mascaraTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.length <= 10 ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '') : d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};
export const formatarPlaca = (p?: string | null) => (p ? (/^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p) : '—');

/** Reduz a foto no próprio celular antes do envio: economiza dados móveis. */
export async function reduzirImagem(arquivo: File, ladoMax = 1600, qualidade = 0.82): Promise<Blob> {
  if (!arquivo.type.startsWith('image/') || arquivo.type === 'image/gif') return arquivo;
  const bmp = await createImageBitmap(arquivo).catch(() => null);
  if (!bmp) return arquivo;
  const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), 'image/jpeg', qualidade));
}

export function idLocal() {
  return `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

export function posicaoAtual(timeout = 4000): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => ok(null),
      { timeout, maximumAge: 60_000, enableHighAccuracy: false },
    );
  });
}
