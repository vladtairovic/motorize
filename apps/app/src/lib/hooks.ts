import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface PainelEntregador {
  entregador: {
    id: string; cpf: string; nome: string; nomeSocial: string | null; dataNascimento: string | null; telefone: string; email: string | null;
    bairro: string | null; logradouro: string | null; numero: string | null; latitude: number | null; longitude: number | null;
    tipoAtividade: string | null; plataformas: string[]; cnhNumero: string | null; cnhCategoria: string | null; cnhValidade: string | null;
    motocicleta: { placa: string; renavam: string | null; marca: string; modelo: string; ano: number; cor: string } | null;
  };
  solicitacao: {
    id: string; protocolo: string; status: string; tipo: string; motivo: string | null; enviadaEm: string | null; decididaEm: string | null;
    eventos: { id: string; status: string; mensagem: string | null; atorTipo: string; criadoEm: string }[];
  };
  documentos: Record<string, { id: string; tipo: string; status: string; motivoRecusa: string | null; criadoEm: string; mime: string }>;
  credencial: { id: string; numero: string; status: string; validaAte: string; emitidaEm: string; motivoStatus: string | null } | null;
  notificacoesNaoLidas: number;
  progresso: { dados: boolean; moto: boolean; documentos: boolean; documentosFaltando: string[] };
}

export function usePainel() {
  return useQuery({ queryKey: ['painel'], queryFn: () => api<PainelEntregador>('/entregador/painel', { perfil: 'entregador' }) });
}

export function useSalvar<T>(caminho: string, metodo: 'PUT' | 'POST' = 'PUT') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: T) => api<PainelEntregador>(caminho, { method: metodo, json: dados, perfil: 'entregador' }),
    onSuccess: (p) => p && qc.setQueryData(['painel'], p),
  });
}

export const podeEditar = (s?: string) => s === 'RASCUNHO' || s === 'PENDENCIA';
