import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cabecalho, Erro, Vazio } from '../components/ui';
import { dataHoraBR } from '../lib/util';

export function Comunicados() {
  const qc = useQueryClient();
  const [f, setF] = useState({ titulo: '', mensagem: '', bairro: '' });
  const [ok, setOk] = useState('');
  const bairros = useQuery({ queryKey: ['bairros'], queryFn: () => api<string[]>('/admin/bairros') });
  const lista = useQuery({ queryKey: ['comunicados'], queryFn: () => api<any[]>('/admin/comunicados') });
  const enviar = useMutation({
    mutationFn: () => api('/admin/comunicados', { method: 'POST', json: { ...f, bairro: f.bairro || undefined } }),
    onSuccess: (r) => { setOk(`Enviado para ${r.destinatarios} entregador(es).`); setF({ titulo: '', mensagem: '', bairro: '' }); qc.invalidateQueries({ queryKey: ['comunicados'] }); },
  });

  function submeter(e: FormEvent) {
    e.preventDefault();
    setOk('');
    enviar.mutate();
  }

  return (
    <>
      <Cabecalho titulo="Comunicados" sub="Mensagens oficiais que aparecem na aba Avisos do app do entregador." />
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submeter} className="painel space-y-4 self-start p-5">
          <h2 className="font-cond text-xl font-bold text-indigo">Novo comunicado</h2>
          {enviar.error && <Erro>{enviar.error.message}</Erro>}
          {ok && <p className="rounded-lg bg-ok-100 px-3 py-2 font-semibold text-ok" role="status">{ok}</p>}
          <label className="block"><span className="rotulo">Título</span>
            <input className="entrada" maxLength={120} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Interdição na Av. principal" />
          </label>
          <label className="block"><span className="rotulo">Mensagem</span>
            <textarea className="entrada min-h-32 py-2" maxLength={1000} value={f.mensagem} onChange={(e) => setF({ ...f, mensagem: e.target.value })} />
            <span className="text-[13px] text-cinza">Linguagem simples e direta. {f.mensagem.length}/1000</span>
          </label>
          <label className="block"><span className="rotulo">Para quem</span>
            <select className="entrada" value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })}>
              <option value="">Todos os entregadores</option>
              {bairros.data?.map((b) => <option key={b} value={b}>Só quem atua em {b}</option>)}
            </select>
          </label>
          <button className="btn-primario w-full" disabled={enviar.isPending || f.titulo.length < 3 || f.mensagem.length < 5}>Enviar comunicado</button>
        </form>

        <section className="painel">
          <h2 className="px-5 pt-5 font-cond text-xl font-bold text-indigo">Enviados</h2>
          {!lista.data?.length ? <Vazio>Nenhum comunicado enviado ainda.</Vazio> : (
            <ul className="divide-y divide-linha">
              {lista.data.map((c, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{c.titulo}</p>
                    <p className="text-sm text-cinza">{dataHoraBR(c.enviado_em)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-cinza">{c.mensagem}</p>
                  <p className="mt-2 text-sm">{c.destinatarios} destinatário(s) · <b>{c.lidas}</b> leram ({Math.round((100 * c.lidas) / Math.max(1, c.destinatarios))}%)</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
