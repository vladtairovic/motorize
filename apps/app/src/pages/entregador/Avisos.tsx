import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Carregando, Topo } from '../../components/ui';
import { NavInferior } from '../../components/NavInferior';
import { dataHoraBR } from '../../lib/util';

interface Notificacao { id: string; titulo: string; mensagem: string; tipo: string; lidaEm: string | null; criadoEm: string }

const COR: Record<string, string> = {
  PENDENCIA: 'border-alerta', APROVACAO: 'border-ok', VENCIMENTO: 'border-alerta', COMUNICADO: 'border-lavado', INFO: 'border-linha',
};

export function Avisos() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['avisos'], queryFn: () => api<Notificacao[]>('/entregador/notificacoes', { perfil: 'entregador' }) });

  useEffect(() => {
    if (data?.some((n) => !n.lidaEm))
      api('/entregador/notificacoes/lidas', { method: 'POST', perfil: 'entregador' }).then(() => qc.invalidateQueries({ queryKey: ['painel'] }));
  }, [data, qc]);

  return (
    <div className="pb-28">
      <Topo titulo="Avisos" voltar="/painel" />
      <main className="flex flex-col gap-3 p-4">
        {isLoading && <Carregando />}
        {data?.length === 0 && <p className="p-6 text-center text-cinza">Nenhum aviso por enquanto. Quando a CTTU analisar seu cadastro ou enviar um comunicado, ele aparece aqui.</p>}
        {data?.map((n) => (
          <article key={n.id} className={`cartao border-l-4 ${COR[n.tipo] ?? 'border-linha'} ${n.lidaEm ? '' : 'bg-refletivo-100/40'}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{n.titulo}</h2>
              {!n.lidaEm && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-erro" aria-label="Novo" />}
            </div>
            <p className="mt-1 whitespace-pre-line text-[15px]">{n.mensagem}</p>
            <p className="mt-2 text-sm text-cinza">{dataHoraBR(n.criadoEm)}{n.tipo === 'COMUNICADO' ? ' · Comunicado da Prefeitura' : ''}</p>
          </article>
        ))}
      </main>
      <NavInferior />
    </div>
  );
}
