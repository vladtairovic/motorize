import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Carregando, Dado, Erro, Modal, Placa, Status } from '../components/ui';
import { ATIVIDADES, RESULTADO, cpfFmt, dataBR, dataHoraBR, telFmt } from '../lib/util';

export function Entregador() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: e, isLoading, error } = useQuery({ queryKey: ['entregador', id], queryFn: () => api(`/admin/entregadores/${id}`) });
  const [acao, setAcao] = useState<null | { cred: string; status: 'ATIVA' | 'SUSPENSA' | 'REVOGADA' }>(null);
  const [motivo, setMotivo] = useState('');
  const alterar = useMutation({
    mutationFn: () => api(`/admin/credenciais/${acao!.cred}/status`, { method: 'PATCH', json: { status: acao!.status, motivo } }),
    onSuccess: () => { setAcao(null); setMotivo(''); qc.invalidateQueries({ queryKey: ['entregador', id] }); },
  });

  if (isLoading) return <Carregando />;
  if (error || !e) return <Erro>{(error as Error)?.message}</Erro>;
  const m = e.motocicleta;
  const atual = e.credenciais[0];

  return (
    <>
      <Link to="/entregadores" className="text-sm font-semibold text-motor hover:underline">‹ Entregadores</Link>
      <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <section className="painel p-5">
          <div className="flex gap-5">
            {e.foto ? <img src={e.foto} alt={`Foto de ${e.nome}`} className="h-40 w-32 rounded-lg object-cover ring-1 ring-linha" /> : <div className="grid h-40 w-32 place-items-center rounded-lg bg-neve text-cinza">Sem foto</div>}
            <div>
              <h1 className="font-cond text-3xl font-bold leading-tight text-ink">{e.nome}</h1>
              {e.nomeSocial && <p className="text-cinza">Nome social: {e.nomeSocial}</p>}
              <p className="mt-1">{ATIVIDADES[e.tipoAtividade] ?? '—'}</p>
              {m && <div className="mt-3 flex items-center gap-2"><Placa placa={m.placa} /><span className="text-cinza">{m.marca} {m.modelo} {m.ano} · {m.cor}</span></div>}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            <Dado r="CPF" v={cpfFmt(e.cpf)} />
            <Dado r="Telefone" v={telFmt(e.telefone)} />
            <Dado r="Bairro" v={e.bairro} />
            <Dado r="Plataformas" v={e.plataformas?.join(', ')} />
            <Dado r="CNH" v={e.cnhNumero && `${e.cnhCategoria} · vence ${dataBR(e.cnhValidade)}`} />
            <Dado r="Conta criada" v={dataBR(e.criadoEm)} />
            <Dado r="Consentimento LGPD" v={`v${e.consentimentoVersao} em ${dataBR(e.consentimentoEm)}`} />
          </dl>
        </section>

        <div className="space-y-5">
          <section className="painel p-5">
            <h2 className="mb-3 font-cond text-xl font-bold text-ink">Credenciais</h2>
            {!e.credenciais.length && <p className="text-cinza">Nenhuma credencial emitida.</p>}
            <ul className="divide-y divide-linha">
              {e.credenciais.map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-cond text-lg font-bold">{c.numero} <Status s={c.status === 'ATIVA' && new Date(c.validaAte) < new Date() ? 'VENCIDA' : c.status} /></p>
                    <p className="text-sm text-cinza">Emitida {dataBR(c.emitidaEm)} · válida até {dataBR(c.validaAte)}</p>
                    {c.motivoStatus && <p className="text-sm">{c.motivoStatus}</p>}
                  </div>
                  {c.id === atual?.id && c.status !== 'REVOGADA' && (
                    <div className="flex gap-2">
                      {c.status === 'ATIVA' && <button className="btn-secundario" onClick={() => setAcao({ cred: c.id, status: 'SUSPENSA' })}>Suspender</button>}
                      {c.status === 'SUSPENSA' && <button className="btn-secundario" onClick={() => setAcao({ cred: c.id, status: 'ATIVA' })}>Reativar</button>}
                      <button className="btn-secundario text-erro" onClick={() => setAcao({ cred: c.id, status: 'REVOGADA' })}>Revogar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="painel p-5">
            <h2 className="mb-3 font-cond text-xl font-bold text-ink">Solicitações</h2>
            <ul className="divide-y divide-linha">
              {e.solicitacoes.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/solicitacoes/${s.id}`} className="font-cond text-lg font-semibold text-ink hover:underline">{s.protocolo}</Link>
                  <span className="flex items-center gap-3 text-sm text-cinza">{dataBR(s.criadoEm)} <Status s={s.status} /></span>
                </li>
              ))}
            </ul>
          </section>
          <section className="painel p-5">
            <h2 className="mb-3 font-cond text-xl font-bold text-ink">Consultas em campo</h2>
            {!e.consultas.length ? <p className="text-cinza">Nenhuma consulta registrada.</p> : (
              <table className="tabela text-sm">
                <thead><tr><th>Quando</th><th>Resultado</th><th>Agente</th><th>Modo</th></tr></thead>
                <tbody>
                  {e.consultas.map((c: any, i: number) => (
                    <tr key={i}><td>{dataHoraBR(c.realizada_em)}</td><td>{RESULTADO[c.resultado]}</td><td>{c.agente}</td><td>{c.offline ? 'Sem sinal' : 'Online'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      {acao && (
        <Modal titulo={{ ATIVA: 'Reativar credencial', SUSPENSA: 'Suspender credencial', REVOGADA: 'Revogar credencial' }[acao.status]} onFechar={() => setAcao(null)}>
          <p className="mb-2">{acao.status === 'REVOGADA' ? 'A revogação é definitiva: o entregador precisará de nova solicitação.' : 'O entregador é avisado no app.'} Informe o motivo:</p>
          <textarea className="entrada mb-3 min-h-20 py-2" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
          {alterar.error && <div className="mb-3"><Erro>{alterar.error.message}</Erro></div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secundario" onClick={() => setAcao(null)}>Cancelar</button>
            <button className={acao.status === 'ATIVA' ? 'btn-ok' : 'btn-perigo'} disabled={motivo.trim().length < 5 || alterar.isPending} onClick={() => alterar.mutate()}>Confirmar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
