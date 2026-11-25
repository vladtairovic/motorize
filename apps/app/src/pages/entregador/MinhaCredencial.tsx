import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, ErroApi } from '../../lib/api';
import { meta } from '../../lib/offline';
import { Aviso, Carregando, FotoPessoa, Placa, Qr, Topo } from '../../components/ui';
import { NavInferior } from '../../components/NavInferior';
import { ATIVIDADES, dataBR } from '../../lib/util';

interface Credencial {
  numero: string; status: string; validaAte: string; emitidaEm: string; token: string; foto: string | null; motivoStatus: string | null;
  entregador: { nome: string; nomeSocial: string | null; tipoAtividade: string | null; motocicleta: { placa: string; modelo: string; cor: string } | null };
}

/** Guarda a credencial no aparelho: abre mesmo sem sinal (offline-first). */
async function carregar(): Promise<Credencial & { doCache?: boolean }> {
  try {
    const c = await api<Credencial>('/entregador/credencial', { perfil: 'entregador' });
    await meta.salvar('minhaCredencial', c);
    return c;
  } catch (e) {
    if (e instanceof ErroApi && e.status === 404) {
      await meta.salvar('minhaCredencial', null);
      throw e;
    }
    const cache = await meta.ler<Credencial>('minhaCredencial');
    if (cache) return { ...cache, doCache: true };
    throw e;
  }
}

function useTelaAcesa() {
  useEffect(() => {
    let lock: any;
    (navigator as any).wakeLock?.request('screen').then((l: any) => (lock = l)).catch(() => {});
    return () => lock?.release?.();
  }, []);
}

export function MinhaCredencial() {
  const { data: c, isLoading, error } = useQuery({ queryKey: ['credencial'], queryFn: carregar, retry: false });
  const [qrGrande, setQrGrande] = useState(false);
  useTelaAcesa();

  if (isLoading) return <><Topo titulo="Minha credencial" voltar="/painel" /><Carregando /></>;
  if (error || !c)
    return (
      <div className="pb-28">
        <Topo titulo="Minha credencial" voltar="/painel" />
        <div className="flex flex-col gap-4 p-5">
          <Aviso tom="info" titulo="Credencial ainda não emitida">{(error as Error)?.message}</Aviso>
          <Link to="/painel" className="btn-secundario">Ver meu cadastro</Link>
        </div>
        <NavInferior />
      </div>
    );

  const nome = c.entregador.nomeSocial || c.entregador.nome;
  const vencida = c.status === 'VENCIDA' || new Date(c.validaAte) < new Date();
  const valida = c.status === 'ATIVA' && !vencida;
  const m = c.entregador.motocicleta;

  if (qrGrande)
    return (
      <button className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-6" onClick={() => setQrGrande(false)} aria-label="Fechar QR ampliado">
        <Qr valor={c.token} tamanho={Math.min(window.innerWidth - 48, 420)} />
        <p className="font-cond text-2xl font-bold text-ink">{c.numero}</p>
        <p className="text-cinza">Toque para fechar</p>
      </button>
    );

  return (
    <div className="pb-28">
      <Topo titulo="Minha credencial" voltar="/painel" />
      <main className="flex flex-col gap-4 p-4">
        {c.doCache && <Aviso tom="neutro">Mostrando a cópia salva no celular. A validade é conferida pelo agente.</Aviso>}
        {!valida && (
          <Aviso tom="erro" titulo={vencida ? 'Credencial vencida' : `Credencial ${c.status.toLowerCase()}`}>
            {vencida ? 'Renove pelo início do app.' : c.motivoStatus}
          </Aviso>
        )}

        <article className={`escuro costura overflow-hidden rounded-3xl text-white shadow-xl ${valida ? '' : 'grayscale'}`} aria-label="Credencial municipal">
          <header className="flex items-center justify-between px-6 pt-6">
            <div>
              <p className="font-cond text-sm font-semibold tracking-[0.12em] text-refletivo">PREFEITURA DE TORITAMA · CTTU</p>
              <p className="font-cond text-lg font-semibold">Credencial de Entregador</p>
            </div>
            <img src="/icone.svg" alt="" className="h-10" />
          </header>

          <div className="flex gap-4 px-6 pt-5">
            <FotoPessoa src={c.foto} nome={nome} className="h-32 w-26 shrink-0 rounded-xl ring-2 ring-white/70" />
            <div className="flex min-w-0 flex-col justify-between">
              <div>
                <p className="font-cond text-[28px] font-bold leading-[1.05]">{nome}</p>
                <p className="mt-1 text-[15px] text-white/80">{ATIVIDADES[c.entregador.tipoAtividade ?? ''] ?? 'Entregador'}</p>
              </div>
              {m && (
                <div className="flex items-center gap-2">
                  <Placa placa={m.placa} />
                  <span className="text-sm text-white/80">{m.modelo}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mx-6 mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 text-center">
            <div className="bg-ink/40 px-3 py-2">
              <p className="text-xs text-white/70">Número</p>
              <p className="font-cond text-xl font-bold tracking-wide">{c.numero}</p>
            </div>
            <div className="bg-ink/40 px-3 py-2">
              <p className="text-xs text-white/70">Válida até</p>
              <p className="font-cond text-xl font-bold">{dataBR(c.validaAte)}</p>
            </div>
          </div>

          <button onClick={() => setQrGrande(true)} className="mx-auto my-6 block rounded-2xl bg-white p-3" aria-label="Ampliar QR Code">
            <Qr valor={c.token} tamanho={210} />
          </button>
          <p className={`py-3 text-center font-cond text-lg font-bold ${valida ? 'bg-refletivo text-ink' : 'bg-erro text-white'}`}>
            {valida ? 'CREDENCIADO' : vencida ? 'VENCIDA' : c.status}
          </p>
        </article>

        <p className="px-2 text-center text-[15px] text-cinza">
          Mostre o QR Code ao agente. Toque nele para ampliar. Funciona sem internet.
        </p>
      </main>
      <NavInferior />
    </div>
  );
}
