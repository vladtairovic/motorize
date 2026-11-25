import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cabecalho, Carregando, Erro, Paginacao, Placa, Status, Vazio } from '../components/ui';
import { ATIVIDADES, dataHoraBR, relativo } from '../lib/util';

const ABAS = [
  { id: 'ENVIADA', rotulo: 'Aguardando' },
  { id: 'EM_ANALISE', rotulo: 'Em análise' },
  { id: 'PENDENCIA', rotulo: 'Com pendência' },
  { id: 'APROVADA', rotulo: 'Aprovadas' },
  { id: 'REPROVADA', rotulo: 'Reprovadas' },
  { id: '', rotulo: 'Todas' },
];

export function Solicitacoes() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ENVIADA';
  const pagina = Number(params.get('pagina') ?? 1);
  const [busca, setBusca] = useState(params.get('busca') ?? '');
  const q = new URLSearchParams({ ...(status && { status }), pagina: String(pagina), ...(params.get('busca') && { busca: params.get('busca')! }) });

  const { data, isLoading, error } = useQuery({
    queryKey: ['solicitacoes', q.toString()],
    queryFn: () => api(`/admin/solicitacoes?${q}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const mudar = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    v ? n.set(k, v) : n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    if (k === 'status' && !v) n.set('status', '');
    setParams(n);
  };

  return (
    <>
      <Cabecalho titulo="Solicitações" sub="Fila de análise documental. As mais antigas aparecem primeiro." />
      <div className="painel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-4 pt-3">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {ABAS.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={status === a.id}
                onClick={() => mudar('status', a.id)}
                className={`whitespace-nowrap border-b-[3px] px-3 pb-2.5 pt-1 font-semibold ${status === a.id ? 'border-refletivo text-ink' : 'border-transparent text-cinza hover:text-ink'}`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); mudar('busca', busca); }}>
            <input className="entrada w-64" placeholder="Nome, CPF, placa ou protocolo" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
            <button className="btn-secundario">Buscar</button>
          </form>
        </div>
        {isLoading ? <Carregando /> : error ? <div className="p-4"><Erro>{(error as Error).message}</Erro></div> : (
          <>
            {data.itens.length === 0 ? (
              <Vazio>{status === 'ENVIADA' ? 'Nenhuma solicitação aguardando. Fila em dia.' : 'Nada encontrado com esses filtros.'}</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr><th>Protocolo</th><th>Entregador</th><th>Placa</th><th>Atividade</th><th>Enviada</th><th>Situação</th><th>Analista</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.itens.map((s: any) => (
                      <tr key={s.id}>
                        <td className="font-cond text-base font-semibold">{s.protocolo}{s.tipo === 'RENOVACAO' && <span className="ml-1.5 text-xs font-sans text-motor">renovação</span>}</td>
                        <td>
                          <p className="font-medium">{s.entregadorNome}</p>
                          <p className="text-[13px] text-cinza">{s.bairro ?? '—'}</p>
                        </td>
                        <td><Placa placa={s.placa} /></td>
                        <td>{ATIVIDADES[s.tipoAtividade] ?? '—'}</td>
                        <td className="whitespace-nowrap" title={dataHoraBR(s.enviadaEm)}>{relativo(s.enviadaEm)}</td>
                        <td><Status s={s.status} />{s.qtdPendencias > 0 && <span className="ml-1.5 text-xs text-cinza">{s.qtdPendencias}× devolvida</span>}</td>
                        <td className="text-cinza">{s.analistaNome ?? '—'}</td>
                        <td className="text-right">
                          <Link className={s.status === 'ENVIADA' ? 'btn-primario' : 'btn-secundario'} to={`/solicitacoes/${s.id}`}>
                            {s.status === 'ENVIADA' ? 'Analisar' : 'Abrir'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} onMudar={(p) => mudar('pagina', String(p))} />
          </>
        )}
      </div>
    </>
  );
}
