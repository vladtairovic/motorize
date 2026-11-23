import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { obterChave, verificarOffline } from '../lib/verificar';
import { Aviso, Placa, Topo } from '../components/ui';
import { LeitorQr } from '../components/LeitorQr';
import { RESULTADO, dataBR } from '../lib/util';

interface Resultado { resultado: string; credencial: { numero: string; nome: string; placa: string | null; validaAte: string } | null; offline?: boolean }

/** Para comerciantes e cidadãos: confere se o entregador é credenciado. Mostra o mínimo de dados. */
export function ValidarPublico() {
  const [r, setR] = useState<Resultado | null>(null);
  const [lendo, setLendo] = useState(true);

  const ler = useCallback(async (token: string) => {
    setLendo(false);
    try {
      setR(await api<Resultado>('/publico/validar', { method: 'POST', json: { token } }));
    } catch {
      // Sem internet: confere ao menos a assinatura digital
      const chave = await obterChave();
      const p = chave ? await verificarOffline(token, chave) : null;
      if (!p) return setR({ resultado: 'INVALIDA', credencial: null, offline: true });
      const venc = p.ex * 1000 < Date.now();
      setR({ resultado: venc ? 'VENCIDA' : 'VALIDA', credencial: { numero: p.n, nome: p.nm, placa: p.pl, validaAte: new Date(p.ex * 1000).toISOString() }, offline: true });
    }
  }, []);

  const info = r && RESULTADO[r.resultado];
  const fundo = info && { ok: 'bg-ok', alerta: 'bg-alerta', erro: 'bg-erro' }[info.tom];

  return (
    <>
      <Topo titulo="Conferir credencial" voltar="/" />
      <main className="flex flex-col gap-4 p-5">
        {lendo && (
          <>
            <p className="text-cinza">Aponte a câmera para o QR Code da credencial do entregador.</p>
            <LeitorQr onLer={ler} />
          </>
        )}
        {r && info && (
          <>
            <div className={`${fundo} rounded-2xl p-6 text-center text-white`} role="status">
              <p className="font-cond text-3xl font-bold">{info.titulo}</p>
              {r.credencial && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-xl font-semibold">{r.credencial.nome}</p>
                  {r.credencial.placa && <Placa placa={r.credencial.placa} grande />}
                  <p className="text-white/90">{r.credencial.numero} · válida até {dataBR(r.credencial.validaAte)}</p>
                </div>
              )}
            </div>
            {r.offline && <Aviso tom="neutro">Sem internet: conferimos só a assinatura digital. Suspensões recentes podem não aparecer.</Aviso>}
            <p className="text-sm text-cinza">Confira se a placa é a da moto e se o nome bate com o documento do entregador.</p>
            <button className="btn-primario" onClick={() => { setR(null); setLendo(true); }}>Conferir outra</button>
          </>
        )}
      </main>
    </>
  );
}
