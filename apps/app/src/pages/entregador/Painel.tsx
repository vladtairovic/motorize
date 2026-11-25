import { Link, useNavigate } from 'react-router';
import { usePainel, useSalvar } from '../../lib/hooks';
import { Aviso, Carregando, Selo, Topo } from '../../components/ui';
import { NavInferior } from '../../components/NavInferior';
import { DOCS, STATUS_SOL, dataBR } from '../../lib/util';

export function Painel() {
  const { data: p, isLoading, error } = usePainel();
  const renovar = useSalvar<void>('/entregador/renovacao', 'POST');
  const nav = useNavigate();

  if (isLoading) return <><Topo /><Carregando /></>;
  if (error || !p) return <><Topo /><div className="p-5"><Aviso tom="erro">{(error as Error)?.message}</Aviso></div></>;

  const { solicitacao: s, progresso: pr, credencial: c } = p;
  const st = STATUS_SOL[s.status];
  const nome = (p.entregador.nomeSocial || p.entregador.nome).split(' ')[0];
  const diasParaVencer = c ? Math.ceil((+new Date(c.validaAte) - Date.now()) / 864e5) : null;
  const proxima = !pr.dados ? '/cadastro/dados' : !pr.moto ? '/cadastro/moto' : !pr.documentos ? '/cadastro/documentos' : '/cadastro/revisar';

  const etapas = [
    { nome: 'Seus dados e CNH', ok: pr.dados, to: '/cadastro/dados' },
    { nome: 'Dados da moto', ok: pr.moto, to: '/cadastro/moto' },
    { nome: 'Fotos dos documentos', ok: pr.documentos, to: '/cadastro/documentos' },
  ];

  return (
    <div className="pb-28">
      <Topo />
      <main className="flex flex-col gap-4 p-4">
        <div className="px-1 pt-1">
          <h1 className="titulo-tela">Olá, {nome}</h1>
          <p className="mt-1 text-cinza">Protocolo {s.protocolo}</p>
        </div>

        {/* Credencial ativa: atalho principal */}
        {c && s.status === 'APROVADA' && (
          <Link to="/credencial" className="escuro costura block rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-cond text-sm font-semibold tracking-wider text-refletivo">CREDENCIAL {c.numero}</span>
              <Selo tom={c.status === 'ATIVA' ? 'ok' : 'erro'}>{c.status === 'ATIVA' ? 'Ativa' : c.status.toLowerCase()}</Selo>
            </div>
            <p className="mt-3 font-cond text-3xl font-bold">Abrir minha credencial</p>
            <p className="mt-1 text-white/80">Válida até {dataBR(c.validaAte)} · funciona sem internet</p>
          </Link>
        )}

        {c?.status === 'SUSPENSA' && <Aviso tom="erro" titulo="Sua credencial está suspensa">{c.motivoStatus}</Aviso>}

        {diasParaVencer !== null && s.status === 'APROVADA' && diasParaVencer <= 60 && (
          <div className="cartao flex flex-col gap-3">
            <p className="font-semibold">
              {diasParaVencer < 0 ? 'Sua credencial venceu.' : `Sua credencial vence em ${diasParaVencer} dias.`}
            </p>
            <p className="text-[15px] text-cinza">A renovação aproveita os documentos já aceitos. Você só revisa e envia.</p>
            <button className="btn-destaque" disabled={renovar.isPending} onClick={() => renovar.mutate(undefined, { onSuccess: () => nav('/cadastro/revisar') })}>
              Renovar credencial
            </button>
            {renovar.error && <Aviso tom="erro">{renovar.error.message}</Aviso>}
          </div>
        )}

        {s.status === 'PENDENCIA' && (
          <div className="cartao flex flex-col gap-3 ring-2 ring-alerta/40">
            <Selo tom="alerta">Precisa de correção</Selo>
            <p className="font-semibold">A CTTU pediu ajustes no seu cadastro:</p>
            <p className="whitespace-pre-line rounded-lg bg-alerta-100 p-3 text-[15px] text-asfalto">{s.motivo}</p>
            <Link to={pr.documentosFaltando.length ? '/cadastro/documentos' : '/cadastro/revisar'} className="btn-primario">Corrigir agora</Link>
          </div>
        )}

        {(s.status === 'ENVIADA' || s.status === 'EM_ANALISE') && (
          <div className="cartao flex flex-col gap-3">
            <Selo tom="info">{st.rotulo}</Selo>
            <p className="font-semibold">Recebemos sua solicitação em {dataBR(s.enviadaEm)}.</p>
            <p className="text-[15px] text-cinza">A CTTU confere os documentos. Você recebe um aviso aqui quando houver resultado.</p>
            <Link to="/solicitacao" className="btn-secundario">Acompanhar solicitação</Link>
          </div>
        )}

        {s.status === 'REPROVADA' && (
          <div className="cartao flex flex-col gap-3">
            <Selo tom="erro">Não aprovada</Selo>
            <p className="text-[15px]">{s.motivo}</p>
            <button className="btn-primario" disabled={renovar.isPending} onClick={() => renovar.mutate(undefined, { onSuccess: () => nav('/cadastro/dados') })}>
              Fazer nova solicitação
            </button>
          </div>
        )}

        {s.status === 'RASCUNHO' && (
          <div className="cartao flex flex-col gap-4">
            <div>
              <p className="font-cond text-2xl font-bold text-ink">Complete seu cadastro</p>
              <p className="text-[15px] text-cinza">Pode parar quando quiser, o que você preencheu fica salvo.</p>
            </div>
            <ol className="flex flex-col divide-y divide-linha">
              {etapas.map((e, i) => (
                <li key={e.nome}>
                  <Link to={e.to} className="flex items-center gap-3 py-3">
                    <span className={`grid size-8 place-items-center rounded-full font-cond font-bold ${e.ok ? 'bg-ok text-white' : 'bg-linha text-asfalto'}`}>
                      {e.ok ? '✓' : i + 1}
                    </span>
                    <span className="flex-1 font-medium">{e.nome}</span>
                    <span className="text-sm text-cinza">{e.ok ? 'Pronto' : 'Pendente'}</span>
                  </Link>
                </li>
              ))}
            </ol>
            {!pr.documentos && pr.documentosFaltando.length < 4 && (
              <p className="text-sm text-cinza">Falta: {pr.documentosFaltando.map((t) => DOCS[t].nome).join(', ')}</p>
            )}
            <Link to={proxima} className="btn-primario">{pr.dados || pr.moto ? 'Continuar cadastro' : 'Começar'}</Link>
          </div>
        )}

        <Link to="/solicitacao" className="cartao flex items-center justify-between">
          <span>
            <span className="block font-semibold">Histórico da solicitação</span>
            <span className="text-sm text-cinza">Situação: {st.rotulo}</span>
          </span>
          <span aria-hidden className="text-2xl text-cinza">›</span>
        </Link>
      </main>
      <NavInferior avisos={p.notificacoesNaoLidas} />
    </div>
  );
}
