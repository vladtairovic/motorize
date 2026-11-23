import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, sessao } from '../lib/api';
import { Cabecalho, Carregando, Erro, Paginacao, Placa, Status, Vazio } from '../components/ui';
import { ATIVIDADES, dataBR } from '../lib/util';

const SITUACOES = [
  ['', 'Todas as situações'], ['ATIVA', 'Credencial ativa'], ['VENCIDA', 'Vencida'], ['SUSPENSA', 'Suspensa'],
  ['ENVIADA', 'Aguardando análise'], ['EM_ANALISE', 'Em análise'], ['PENDENCIA', 'Com pendência'], ['REPROVADA', 'Reprovada'], ['RASCUNHO', 'Cadastro incompleto'],
];

export function Entregadores() {
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState(params.get('busca') ?? '');
  const pagina = Number(params.get('pagina') ?? 1);
  const analista = sessao.ler()?.usuario.papel !== 'GESTOR';
  const q = new URLSearchParams(params);
  q.set('pagina', String(pagina));

  const bairros = useQuery({ queryKey: ['bairros'], queryFn: () => api<string[]>('/admin/bairros'), staleTime: 300_000 });
  const { data, isLoading, error } = useQuery({
    queryKey: ['entregadores', q.toString()],
    queryFn: () => api(`/admin/entregadores?${q}`),
    placeholderData: keepPreviousData,
  });

  const mudar = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    v ? n.set(k, v) : n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setParams(n);
  };

  return (
    <>
      <Cabecalho titulo="Entregadores" sub="Todos os motociclistas com conta no MOTORIZE." />
      <div className="painel">
        <form className="flex flex-wrap gap-2 border-b border-linha p-4" onSubmit={(e) => { e.preventDefault(); mudar('busca', busca); }}>
          <input className="entrada max-w-72" placeholder="Nome, CPF, placa ou nº da credencial" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
          <select className="entrada w-auto" value={params.get('situacao') ?? ''} onChange={(e) => mudar('situacao', e.target.value)} aria-label="Situação">
            {SITUACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select className="entrada w-auto" value={params.get('bairro') ?? ''} onChange={(e) => mudar('bairro', e.target.value)} aria-label="Bairro">
            <option value="">Todos os bairros</option>
            {bairros.data?.map((b) => <option key={b}>{b}</option>)}
          </select>
          <button className="btn-secundario">Buscar</button>
        </form>
        {isLoading ? <Carregando /> : error ? <div className="p-4"><Erro>{(error as Error).message}</Erro></div> : data.itens.length === 0 ? <Vazio>Ninguém encontrado com esses filtros.</Vazio> : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Nome</th><th>Bairro</th><th>Atividade</th><th>Moto</th><th>Credencial</th><th>Validade</th><th>Situação</th></tr></thead>
                <tbody>
                  {data.itens.map((e: any) => (
                    <tr key={e.id}>
                      <td>{analista ? <Link to={`/entregadores/${e.id}`} className="font-semibold text-indigo hover:underline">{e.nome}</Link> : <span className="font-medium">{e.nome}</span>}</td>
                      <td>{e.bairro ?? '—'}</td>
                      <td>{ATIVIDADES[e.tipo_atividade] ?? '—'}</td>
                      <td><div className="flex items-center gap-2"><Placa placa={e.placa} /><span className="text-[13px] text-cinza">{e.modelo}</span></div></td>
                      <td className="font-cond text-base">{e.credencial ?? '—'}</td>
                      <td>{dataBR(e.valida_ate)}</td>
                      <td><Status s={e.situacao} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} onMudar={(p) => mudar('pagina', String(p))} />
          </>
        )}
      </div>
    </>
  );
}
