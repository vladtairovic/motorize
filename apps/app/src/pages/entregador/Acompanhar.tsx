import { usePainel } from '../../lib/hooks';
import { Carregando, Selo, Topo } from '../../components/ui';
import { NavInferior } from '../../components/NavInferior';
import { STATUS_SOL, dataHoraBR } from '../../lib/util';

export function Acompanhar() {
  const { data: p, isLoading } = usePainel();
  if (isLoading || !p) return <><Topo titulo="Minha solicitação" voltar="/painel" /><Carregando /></>;
  const s = p.solicitacao;
  const st = STATUS_SOL[s.status];

  return (
    <div className="pb-28">
      <Topo titulo="Minha solicitação" voltar="/painel" />
      <main className="flex flex-col gap-4 p-4">
        <div className="cartao">
          <p className="text-sm text-cinza">Protocolo</p>
          <p className="font-cond text-3xl font-bold tracking-wide text-ink">{s.protocolo}</p>
          <div className="mt-3"><Selo tom={st.tom}>{st.rotulo}</Selo></div>
        </div>
        <section className="cartao">
          <h2 className="mb-4 font-cond text-xl font-bold text-ink">Histórico</h2>
          <ol className="relative ml-2 border-l-2 border-linha">
            {s.eventos.map((ev, i) => {
              const e = STATUS_SOL[ev.status];
              const cor = { neutro: 'bg-cinza', info: 'bg-motor', alerta: 'bg-alerta', ok: 'bg-ok', erro: 'bg-erro' }[e.tom];
              return (
                <li key={ev.id} className="relative mb-5 pl-6 last:mb-0">
                  <span className={`absolute -left-[9px] top-1 size-4 rounded-full ring-4 ring-white ${cor} ${i === 0 ? 'scale-125' : ''}`} />
                  <p className="font-semibold">{e.rotulo}</p>
                  <p className="text-sm text-cinza">{dataHoraBR(ev.criadoEm)} · {ev.atorTipo === 'SERVIDOR' ? 'CTTU' : 'Você'}</p>
                  {ev.mensagem && <p className="mt-1 whitespace-pre-line text-[15px]">{ev.mensagem}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      </main>
      <NavInferior avisos={p.notificacoesNaoLidas} />
    </div>
  );
}
