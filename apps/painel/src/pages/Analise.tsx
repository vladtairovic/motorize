import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, baixar } from '../lib/api';
import { Carregando, Dado, Erro, Modal, Placa, Status } from '../components/ui';
import { ATIVIDADES, DOCS, STATUS_SOL, cpfFmt, dataBR, dataHoraBR, telFmt } from '../lib/util';

const MOTIVOS_RAPIDOS: Record<string, string[]> = {
  CNH: ['Imagem ilegível', 'CNH vencida', 'Categoria não habilita motocicleta', 'Documento de outra pessoa'],
  CRLV: ['Imagem ilegível', 'Licenciamento vencido', 'Placa diferente da informada'],
  COMPROVANTE_RESIDENCIA: ['Imagem ilegível', 'Mais de 3 meses', 'Endereço fora de Toritama'],
  FOTO: ['Rosto não aparece por inteiro', 'Com capacete ou óculos escuros', 'Foto escura ou desfocada'],
};

function Visualizador({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let u: string | null = null;
    setUrl(null);
    setErro('');
    baixar(`/admin/documentos/${doc.id}/arquivo`).then((b) => setUrl((u = URL.createObjectURL(b)))).catch((e) => setErro(e.message));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [doc.id]);
  if (erro) return <Erro>{erro}</Erro>;
  if (!url) return <div className="grid h-[460px] place-items-center rounded-lg bg-papel text-cinza">Abrindo documento…</div>;
  return doc.mime === 'application/pdf' ? (
    <iframe src={url} title={DOCS[doc.tipo]} className="h-[520px] w-full rounded-lg ring-1 ring-linha" />
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg bg-[#2b2f38] p-2" title="Abrir em tamanho real">
      <img src={url} alt={DOCS[doc.tipo]} className="mx-auto max-h-[520px] object-contain" />
    </a>
  );
}

export function Analise() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: s, isLoading, error } = useQuery({ queryKey: ['solicitacao', id], queryFn: () => api(`/admin/solicitacoes/${id}`) });
  const [aberto, setAberto] = useState('CNH');
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [decisao, setDecisao] = useState<null | 'APROVAR' | 'PENDENCIA' | 'REPROVAR'>(null);
  const [motivoDecisao, setMotivoDecisao] = useState('');
  const [resultado, setResultado] = useState<any>(null);

  const recarregar = () => qc.invalidateQueries({ queryKey: ['solicitacao', id] });
  const iniciar = useMutation({ mutationFn: () => api(`/admin/solicitacoes/${id}/iniciar-analise`, { method: 'POST' }), onSuccess: recarregar });
  const avaliar = useMutation({
    mutationFn: (v: { doc: string; status: 'ACEITO' | 'RECUSADO'; motivoRecusa?: string }) =>
      api(`/admin/documentos/${v.doc}`, { method: 'PATCH', json: { status: v.status, motivoRecusa: v.motivoRecusa } }),
    onSuccess: () => { setRecusando(null); setMotivo(''); recarregar(); },
  });
  const decidir = useMutation({
    mutationFn: () => api(`/admin/solicitacoes/${id}/decisao`, { method: 'POST', json: { decisao, motivo: motivoDecisao || undefined } }),
    onSuccess: (r) => { setDecisao(null); setResultado(r); recarregar(); qc.invalidateQueries({ queryKey: ['solicitacoes'] }); qc.invalidateQueries({ queryKey: ['indicadores'] }); },
  });

  if (isLoading) return <Carregando />;
  if (error || !s) return <Erro>{(error as Error)?.message}</Erro>;

  const e = s.entregador;
  const m = e.motocicleta;
  const docs = s.documentosVigentes as Record<string, any>;
  const emAnalise = s.status === 'EM_ANALISE';
  const doc = docs[aberto];
  const todosAceitos = Object.keys(DOCS).every((t) => docs[t]?.status === 'ACEITO');
  const algumRecusado = Object.values(docs).some((d: any) => d.status === 'RECUSADO');
  const idade = e.dataNascimento ? Math.floor((Date.now() - +new Date(e.dataNascimento)) / (365.25 * 864e5)) : null;
  const cnhVencida = e.cnhValidade && new Date(e.cnhValidade) < new Date();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/solicitacoes" className="text-sm font-semibold text-lavado hover:underline">‹ Voltar para a fila</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-cond text-[32px] font-bold leading-none text-indigo">
            {s.protocolo} <Status s={s.status} />
          </h1>
          <p className="mt-1 text-cinza">
            {s.tipo === 'RENOVACAO' ? 'Renovação' : 'Primeiro credenciamento'} · enviada {dataHoraBR(s.enviadaEm)}
            {s.analista && ` · analista: ${s.analista.nome}`}
          </p>
        </div>
        {s.status === 'ENVIADA' && (
          <button className="btn-primario" onClick={() => iniciar.mutate()} disabled={iniciar.isPending}>Iniciar análise</button>
        )}
      </div>
      {iniciar.error && <div className="mb-4"><Erro>{iniciar.error.message}</Erro></div>}
      {resultado && (
        <div className="mb-5 rounded-lg border-l-4 border-ok bg-ok-100 px-4 py-3" role="status">
          <p className="font-semibold text-ok">
            {resultado.status === 'APROVADA' ? `Aprovada. Credencial ${resultado.credencial.numero} emitida, válida até ${dataBR(resultado.credencial.validaAte)}.` : `Decisão registrada: ${STATUS_SOL[resultado.status].rotulo}. O entregador foi avisado no app.`}
          </p>
          <button className="mt-1 text-sm font-semibold text-indigo hover:underline" onClick={() => nav('/solicitacoes')}>Ir para a próxima da fila</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {/* Coluna do entregador */}
        <div className="space-y-5">
          <section className="painel p-5">
            <h2 className="font-cond text-2xl font-bold">{e.nome}</h2>
            {e.nomeSocial && <p className="text-sm text-cinza">Nome social: {e.nomeSocial}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Dado r="CPF" v={cpfFmt(e.cpf)} />
              <Dado r="Nascimento" v={e.dataNascimento && `${dataBR(e.dataNascimento)} (${idade} anos)`} />
              <Dado r="Telefone" v={telFmt(e.telefone)} />
              <Dado r="E-mail" v={e.email} />
              <Dado r="Bairro" v={e.bairro} />
              <Dado r="Endereço" v={e.logradouro && `${e.logradouro}, ${e.numero ?? 's/n'}`} />
              <Dado r="Atividade" v={ATIVIDADES[e.tipoAtividade]} />
              <Dado r="Plataformas" v={e.plataformas?.join(', ')} />
            </dl>
          </section>
          <section className="painel p-5">
            <h3 className="mb-3 font-cond text-lg font-bold text-indigo">CNH</h3>
            <dl className="grid grid-cols-3 gap-3">
              <Dado r="Registro" v={e.cnhNumero} />
              <Dado r="Categoria" v={<span className={e.cnhCategoria?.includes('A') ? '' : 'text-erro'}>{e.cnhCategoria}</span>} />
              <Dado r="Validade" v={<span className={cnhVencida ? 'font-semibold text-erro' : ''}>{dataBR(e.cnhValidade)}{cnhVencida && ' · vencida'}</span>} />
            </dl>
          </section>
          <section className="painel p-5">
            <h3 className="mb-3 font-cond text-lg font-bold text-indigo">Motocicleta</h3>
            {m ? (
              <dl className="grid grid-cols-2 gap-3">
                <Dado r="Placa" v={<Placa placa={m.placa} />} />
                <Dado r="RENAVAM" v={m.renavam} />
                <Dado r="Modelo" v={`${m.marca} ${m.modelo}`} />
                <Dado r="Ano · cor" v={`${m.ano} · ${m.cor}`} />
              </dl>
            ) : <p className="text-cinza">Não informada.</p>}
          </section>
          <section className="painel p-5">
            <h3 className="mb-3 font-cond text-lg font-bold text-indigo">Histórico</h3>
            <ol className="space-y-3 text-sm">
              {s.eventos.map((ev: any) => (
                <li key={ev.id} className="border-l-2 border-linha pl-3">
                  <p className="font-semibold">{STATUS_SOL[ev.status]?.rotulo}</p>
                  <p className="text-cinza">{dataHoraBR(ev.criadoEm)} · {ev.atorTipo === 'SERVIDOR' ? 'CTTU' : 'Entregador'}</p>
                  {ev.mensagem && <p className="mt-0.5 whitespace-pre-line">{ev.mensagem}</p>}
                </li>
              ))}
            </ol>
            {s.outrasSolicitacoes.length > 0 && (
              <p className="mt-4 text-sm text-cinza">Solicitações anteriores: {s.outrasSolicitacoes.map((o: any) => `${o.protocolo} (${STATUS_SOL[o.status].rotulo})`).join(', ')}</p>
            )}
          </section>
        </div>

        {/* Análise documental */}
        <section className="painel overflow-hidden">
          <div className="flex overflow-x-auto border-b border-linha" role="tablist" aria-label="Documentos">
            {Object.entries(DOCS).map(([t, nome]) => {
              const d = docs[t];
              const marca = !d ? '○' : d.status === 'ACEITO' ? '✓' : d.status === 'RECUSADO' ? '✕' : '•';
              const cor = !d ? 'text-cinza' : d.status === 'ACEITO' ? 'text-ok' : d.status === 'RECUSADO' ? 'text-erro' : 'text-lavado';
              return (
                <button key={t} role="tab" aria-selected={aberto === t} onClick={() => setAberto(t)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 font-semibold ${aberto === t ? 'border-refletivo bg-papel/60 text-indigo' : 'border-transparent text-cinza'}`}>
                  <span className={cor} aria-hidden>{marca}</span>{nome}
                </button>
              );
            })}
          </div>
          <div className="p-5">
            {!doc ? <p className="py-20 text-center text-cinza">Documento não enviado.</p> : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-cinza">
                  <span>Enviado {dataHoraBR(doc.criadoEm)} · {(doc.tamanho / 1024).toFixed(0)} KB · SHA-256 {doc.sha256.slice(0, 12)}…</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${doc.status === 'ACEITO' ? 'bg-ok-100 text-ok' : doc.status === 'RECUSADO' ? 'bg-erro-100 text-erro' : 'bg-lavado-100 text-indigo'}`}>{doc.status === 'ACEITO' ? 'Aceito' : doc.status === 'RECUSADO' ? 'Recusado' : 'Aguardando avaliação'}</span>
                </div>
                <Visualizador doc={doc} />
                {doc.motivoRecusa && <p className="mt-3 rounded-lg bg-erro-100 px-3 py-2 text-erro">Recusado: {doc.motivoRecusa}</p>}

                {emAnalise && (
                  recusando === doc.id ? (
                    <div className="mt-4 rounded-lg bg-papel p-4">
                      <p className="mb-2 font-semibold">Por que recusar? O entregador vai ler este texto.</p>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {MOTIVOS_RAPIDOS[doc.tipo]?.map((mr) => (
                          <button key={mr} type="button" onClick={() => setMotivo(mr)} className={`rounded-full px-3 py-1 text-sm ring-1 ${motivo === mr ? 'bg-indigo text-white ring-indigo' : 'bg-white ring-linha'}`}>{mr}</button>
                        ))}
                      </div>
                      <textarea className="entrada min-h-20 py-2" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Explique o que precisa ser corrigido" />
                      <div className="mt-3 flex gap-2">
                        <button className="btn-perigo" disabled={!motivo.trim() || avaliar.isPending} onClick={() => avaliar.mutate({ doc: doc.id, status: 'RECUSADO', motivoRecusa: motivo })}>Recusar documento</button>
                        <button className="btn-secundario" onClick={() => setRecusando(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button className="btn-ok" disabled={avaliar.isPending || doc.status === 'ACEITO'}
                        onClick={() => avaliar.mutate({ doc: doc.id, status: 'ACEITO' }, {
                          onSuccess: () => { const prox = Object.keys(DOCS).find((t) => t !== aberto && docs[t]?.status === 'ENVIADO'); if (prox) setAberto(prox); },
                        })}>
                        {doc.status === 'ACEITO' ? 'Aceito' : 'Aceitar'}
                      </button>
                      <button className="btn-secundario text-erro" onClick={() => { setRecusando(doc.id); setMotivo(doc.motivoRecusa ?? ''); }}>Recusar…</button>
                    </div>
                  )
                )}
                {avaliar.error && <div className="mt-3"><Erro>{avaliar.error.message}</Erro></div>}
              </>
            )}
          </div>

          {emAnalise && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha bg-papel/60 px-5 py-4">
              <p className="text-sm text-cinza">
                {todosAceitos ? 'Todos os documentos aceitos.' : algumRecusado ? 'Há documento recusado: devolva com pendência.' : 'Avalie cada documento antes de decidir.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secundario text-erro" onClick={() => setDecisao('REPROVAR')}>Reprovar</button>
                <button className="btn-alerta" onClick={() => setDecisao('PENDENCIA')}>Devolver com pendência</button>
                <button className="btn-ok" disabled={!todosAceitos} onClick={() => setDecisao('APROVAR')}>Aprovar e emitir credencial</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {decisao && (
        <Modal titulo={{ APROVAR: 'Aprovar credenciamento', PENDENCIA: 'Devolver com pendência', REPROVAR: 'Reprovar solicitação' }[decisao]} onFechar={() => setDecisao(null)}>
          {decisao === 'APROVAR' && <p className="mb-4">A credencial digital será emitida e assinada agora. {e.nome.split(' ')[0]} recebe o aviso no app.</p>}
          {decisao === 'PENDENCIA' && (
            <>
              <p className="mb-2">Os motivos dos documentos recusados são enviados automaticamente. Quer acrescentar algo?</p>
              <textarea className="entrada mb-4 min-h-20 py-2" value={motivoDecisao} onChange={(ev) => setMotivoDecisao(ev.target.value)} placeholder="Opcional" />
            </>
          )}
          {decisao === 'REPROVAR' && (
            <>
              <p className="mb-2">Use só quando não houver como corrigir (ex.: sem habilitação para moto). Informe o motivo:</p>
              <textarea className="entrada mb-4 min-h-20 py-2" value={motivoDecisao} onChange={(ev) => setMotivoDecisao(ev.target.value)} />
            </>
          )}
          {decidir.error && <div className="mb-3"><Erro>{decidir.error.message}</Erro></div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secundario" onClick={() => setDecisao(null)}>Cancelar</button>
            <button className={decisao === 'APROVAR' ? 'btn-ok' : decisao === 'PENDENCIA' ? 'btn-alerta' : 'btn-perigo'} disabled={decidir.isPending} onClick={() => decidir.mutate()}>
              {decisao === 'APROVAR' ? 'Aprovar' : decisao === 'PENDENCIA' ? 'Devolver' : 'Reprovar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
