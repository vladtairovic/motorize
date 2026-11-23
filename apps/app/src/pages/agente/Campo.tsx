import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { api, sair, sessao } from '../../lib/api';
import { bd, meta, type ConsultaLocal, type CredencialCache } from '../../lib/offline';
import { verificarOffline } from '../../lib/verificar';
import { Aviso, FotoPessoa, Placa, Topo, useOnline } from '../../components/ui';
import { LeitorQr } from '../../components/LeitorQr';
import { ATIVIDADES, RESULTADO, dataBR, dataHoraBR, idLocal, posicaoAtual } from '../../lib/util';

type Res = ConsultaLocal['resultado'];
interface Exibicao {
  resultado: Res;
  offline: boolean;
  dados: Partial<CredencialCache> & { numero?: string; motivoStatus?: string | null };
  aviso?: string;
}

async function baixarPacote() {
  const p = await api<{ geradoEm: string; chave: { kid: string; x: string }; credenciais: any[] }>('/fiscalizacao/pacote', { perfil: 'agente' });
  await bd.transaction('rw', bd.credenciais, bd.meta, async () => {
    await bd.credenciais.clear();
    await bd.credenciais.bulkPut(
      p.credenciais.map((c) => ({
        numero: c.numero, status: c.status, validaAte: c.valida_ate, nome: c.nome, placa: c.placa, modelo: c.modelo, cor: c.cor,
        foto: c.foto, tipoAtividade: c.tipo_atividade,
      })),
    );
    await meta.salvar('chave', p.chave);
    await meta.salvar('pacoteEm', p.geradoEm);
  });
  return p.credenciais.length;
}

async function sincronizar() {
  const pendentes = await bd.consultas.where('sincronizada').equals(0).toArray();
  if (!pendentes.length) return 0;
  const r = await api<{ ids: string[] }>('/fiscalizacao/consultas/sync', {
    method: 'POST', perfil: 'agente',
    json: { consultas: pendentes.map(({ sincronizada, nome, ...c }) => c) },
  });
  await bd.consultas.where('idLocal').anyOf(r.ids).modify({ sincronizada: 1 });
  return r.ids.length;
}

/** Decide o resultado localmente: assinatura Ed25519 + situação no último pacote baixado. */
async function avaliarOffline(token: string): Promise<Exibicao> {
  const chave = await meta.ler<{ kid: string; x: string }>('chave');
  if (!chave) return { resultado: 'INVALIDA', offline: true, dados: {}, aviso: 'Baixe o pacote de dados com internet antes de ir a campo.' };
  const p = await verificarOffline(token, chave);
  if (!p) return { resultado: 'INVALIDA', offline: true, dados: {} };
  const c = await bd.credenciais.get(p.n);
  const vencida = p.ex * 1000 < Date.now() || (c && new Date(c.validaAte) < new Date());
  if (!c)
    return {
      resultado: vencida ? 'VENCIDA' : 'VALIDA', offline: true,
      dados: { numero: p.n, nome: p.nm, placa: p.pl, validaAte: new Date(p.ex * 1000).toISOString() },
      aviso: 'Assinatura autêntica, mas a credencial não está no pacote baixado (emitida depois). Confirme quando tiver sinal.',
    };
  const resultado: Res = c.status === 'REVOGADA' ? 'REVOGADA' : c.status === 'SUSPENSA' ? 'SUSPENSA' : vencida ? 'VENCIDA' : 'VALIDA';
  return { resultado, offline: true, dados: c };
}

export function Campo() {
  const nav = useNavigate();
  const online = useOnline();
  const agente = sessao.ler('agente')?.usuario;
  const [modo, setModo] = useState<'inicio' | 'lendo' | 'resultado'>('inicio');
  const [res, setRes] = useState<Exibicao | null>(null);
  const [msg, setMsg] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const pacoteEm = useLiveQuery(() => meta.ler<string>('pacoteEm'), []);
  const totalCreds = useLiveQuery(() => bd.credenciais.count(), []);
  const pendentes = useLiveQuery(() => bd.consultas.where('sincronizada').equals(0).count(), []);
  const historico = useLiveQuery(() => bd.consultas.orderBy('realizadaEm').reverse().limit(15).toArray(), []);

  const atualizar = useCallback(async (silencioso = false) => {
    setAtualizando(true);
    try {
      const enviadas = await sincronizar();
      const n = await baixarPacote();
      if (!silencioso) setMsg(`Pacote atualizado: ${n} credenciais.${enviadas ? ` ${enviadas} consulta(s) enviada(s).` : ''}`);
    } catch (e) {
      if (!silencioso) setMsg((e as Error).message);
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { if (navigator.onLine) atualizar(true); }, [atualizar]);
  useEffect(() => { if (online) sincronizar().catch(() => {}); }, [online]);

  const ler = useCallback(async (token: string) => {
    setModo('resultado');
    setRes(null);
    const id = idLocal();
    const pos = await posicaoAtual(2500);
    let exib: Exibicao;
    try {
      const r = await api<{ resultado: Res; credencial: any }>('/fiscalizacao/validar', {
        method: 'POST', perfil: 'agente', json: { token, idLocal: id, ...(pos ?? {}) }, signal: AbortSignal.timeout(5000),
      });
      exib = { resultado: r.resultado, offline: false, dados: r.credencial ?? {} };
      await bd.consultas.put({ idLocal: id, numero: r.credencial?.numero ?? null, nome: r.credencial?.nome, resultado: r.resultado, realizadaEm: new Date().toISOString(), ...pos, sincronizada: 1 });
    } catch {
      exib = await avaliarOffline(token);
      await bd.consultas.put({
        idLocal: id, numero: exib.dados.numero ?? null, nome: exib.dados.nome, resultado: exib.resultado,
        realizadaEm: new Date().toISOString(), latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null, sincronizada: 0,
      });
    }
    navigator.vibrate?.(exib.resultado === 'VALIDA' ? 60 : [120, 80, 120]);
    setRes(exib);
  }, []);

  const info = res && RESULTADO[res.resultado];
  const faixa = info && { ok: 'bg-ok', alerta: 'bg-alerta', erro: 'bg-erro' }[info.tom];
  const horasPacote = pacoteEm ? (Date.now() - +new Date(pacoteEm)) / 36e5 : null;

  return (
    <div className="min-h-dvh pb-8">
      <Topo
        titulo="Fiscalização"
        voltar={modo !== 'inicio' ? true : undefined}
        acao={<button className="px-3 text-sm font-semibold text-refletivo" onClick={async () => { await sair('agente'); nav('/agente/entrar', { replace: true }); }}>Sair</button>}
      />

      {modo === 'inicio' && (
        <main className="flex flex-col gap-4 p-4">
          <p className="px-1 text-cinza">{agente?.nome}</p>
          <button className="btn-destaque min-h-24 text-2xl" onClick={() => setModo('lendo')}>Ler credencial</button>

          <section className="cartao flex flex-col gap-2 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Dados para uso sem sinal</span>
              <span className={`text-sm font-semibold ${online ? 'text-ok' : 'text-alerta'}`}>{online ? 'Online' : 'Sem sinal'}</span>
            </div>
            <p className="text-cinza">
              {pacoteEm ? <>{totalCreds} credenciais · atualizado {dataHoraBR(pacoteEm)}</> : 'Ainda não baixado.'}
            </p>
            {horasPacote !== null && horasPacote > 24 && <Aviso tom="alerta">Pacote com mais de 24 h. Atualize quando tiver sinal.</Aviso>}
            {!!pendentes && <p className="text-alerta">{pendentes} consulta(s) aguardando envio</p>}
            <button className="btn-secundario mt-1" disabled={atualizando || !online} onClick={() => atualizar()}>
              {atualizando ? 'Atualizando…' : 'Atualizar agora'}
            </button>
            {msg && <p className="text-sm text-cinza" role="status">{msg}</p>}
          </section>

          <section className="cartao">
            <h2 className="mb-2 font-semibold">Últimas consultas neste aparelho</h2>
            {!historico?.length && <p className="text-[15px] text-cinza">Nenhuma ainda.</p>}
            <ul className="divide-y divide-linha">
              {historico?.map((c) => (
                <li key={c.idLocal} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.nome ?? c.numero ?? 'QR inválido'}</span>
                    <span className="text-sm text-cinza">{dataHoraBR(c.realizadaEm)}{c.sincronizada ? '' : ' · não enviada'}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-semibold ${c.resultado === 'VALIDA' ? 'text-ok' : 'text-erro'}`}>{RESULTADO[c.resultado].titulo.replace('Credencial ', '')}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}

      {modo === 'lendo' && (
        <main className="p-4">
          <LeitorQr onLer={ler} />
        </main>
      )}

      {modo === 'resultado' && (
        <main className="flex flex-col gap-4 p-4">
          {!res && <p className="p-10 text-center text-cinza">Conferindo…</p>}
          {res && info && (
            <>
              <div className={`${faixa} rounded-2xl px-5 py-6 text-center text-white`} role="status">
                <p className="font-cond text-[34px] font-bold leading-none">{info.titulo}</p>
                <p className="mt-2 text-white/90">{res.offline ? 'Conferida sem internet pela assinatura digital' : 'Conferida online'}</p>
              </div>
              {res.aviso && <Aviso tom="alerta">{res.aviso}</Aviso>}
              {res.dados.nome && (
                <div className="cartao flex gap-4">
                  <FotoPessoa src={res.dados.foto} nome={res.dados.nome} className="h-36 w-28 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="font-cond text-2xl font-bold leading-tight text-indigo">{res.dados.nome}</p>
                    {res.dados.tipoAtividade && <p className="text-sm text-cinza">{ATIVIDADES[res.dados.tipoAtividade]}</p>}
                    {res.dados.placa && <div><Placa placa={res.dados.placa} /></div>}
                    {res.dados.modelo && <p className="text-[15px]">{res.dados.modelo} · {res.dados.cor}</p>}
                    <p className="text-[15px]"><b>{res.dados.numero}</b> · até {dataBR(res.dados.validaAte)}</p>
                  </div>
                </div>
              )}
              {res.dados.motivoStatus && <Aviso tom="erro" titulo="Motivo registrado">{res.dados.motivoStatus}</Aviso>}
              <p className="text-sm text-cinza">Compare o rosto com a foto e a placa com a moto.</p>
              <button className="btn-primario" onClick={() => setModo('lendo')}>Ler outra</button>
              <button className="btn-secundario" onClick={() => setModo('inicio')}>Voltar</button>
            </>
          )}
        </main>
      )}
    </div>
  );
}
