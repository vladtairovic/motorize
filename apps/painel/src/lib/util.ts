export const STATUS_SOL: Record<string, { rotulo: string; cls: string }> = {
  RASCUNHO: { rotulo: 'Em preenchimento', cls: 'bg-linha text-asfalto' },
  ENVIADA: { rotulo: 'Aguardando análise', cls: 'bg-neve text-ink' },
  EM_ANALISE: { rotulo: 'Em análise', cls: 'bg-refletivo-100 text-[#6b5200]' },
  PENDENCIA: { rotulo: 'Com pendência', cls: 'bg-alerta-100 text-alerta' },
  APROVADA: { rotulo: 'Aprovada', cls: 'bg-ok-100 text-ok' },
  REPROVADA: { rotulo: 'Reprovada', cls: 'bg-erro-100 text-erro' },
  ATIVA: { rotulo: 'Credencial ativa', cls: 'bg-ok-100 text-ok' },
  SUSPENSA: { rotulo: 'Suspensa', cls: 'bg-erro-100 text-erro' },
  REVOGADA: { rotulo: 'Revogada', cls: 'bg-linha text-cinza' },
  VENCIDA: { rotulo: 'Vencida', cls: 'bg-alerta-100 text-alerta' },
};
export const ATIVIDADES: Record<string, string> = {
  APP_DELIVERY: 'App de entrega', MOTOFRETE: 'Motofrete', MOTOTAXI: 'Mototáxi', AUTONOMO: 'Autônomo', NAO_INFORMADO: 'Não informado',
};
export const DOCS: Record<string, string> = { CNH: 'CNH', CRLV: 'CRLV (moto)', COMPROVANTE_RESIDENCIA: 'Comprovante de residência', FOTO: 'Foto da credencial' };
export const RESULTADO: Record<string, string> = {
  VALIDA: 'Válida', VENCIDA: 'Vencida', SUSPENSA: 'Suspensa', REVOGADA: 'Revogada', INVALIDA: 'QR inválido', NAO_ENCONTRADA: 'Não encontrada',
};
export const PAPEIS: Record<string, string> = { ADMIN: 'Administrador', ANALISTA: 'Analista (backoffice)', AGENTE: 'Agente de campo', GESTOR: 'Gestor (Prefeitura)' };

const TZ = 'America/Recife';
export const dataBR = (d?: string | null) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('pt-BR', { timeZone: TZ }) : '—');
export const dataHoraBR = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }) : '—');
export const relativo = (d?: string | null) => {
  if (!d) return '—';
  const h = (Date.now() - +new Date(d)) / 36e5;
  if (h < 1) return 'há menos de 1 h';
  if (h < 24) return `há ${Math.floor(h)} h`;
  return `há ${Math.floor(h / 24)} dia(s)`;
};
export const cpfFmt = (c?: string) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c ?? '—');
export const telFmt = (t?: string) => (t ? t.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : '—');
export const placaFmt = (p?: string | null) => p ?? '—';
