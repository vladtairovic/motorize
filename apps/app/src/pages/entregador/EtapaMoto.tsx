import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { podeEditar, usePainel, useSalvar } from '../../lib/hooks';
import { ErroApi } from '../../lib/api';
import { Aviso, Campo, Carregando, Etapas, Placa, Topo } from '../../components/ui';

const MARCAS = ['Honda', 'Yamaha', 'Suzuki', 'Shineray', 'Haojue', 'Dafra', 'Kawasaki', 'Outra'];
const CORES = ['Preta', 'Vermelha', 'Branca', 'Prata', 'Cinza', 'Azul', 'Outra'];

export function EtapaMoto() {
  const { data: p, isLoading } = usePainel();
  const salvar = useSalvar('/entregador/motocicleta');
  const nav = useNavigate();
  const [f, setF] = useState<any>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (p && !f) {
      const m = p.entregador.motocicleta;
      setF({ placa: m?.placa ?? '', renavam: m?.renavam ?? '', marca: m?.marca ?? '', modelo: m?.modelo ?? '', ano: m?.ano ?? '', cor: m?.cor ?? '' });
    }
  }, [p, f]);

  if (isLoading || !f || !p) return <><Topo titulo="Sua moto" voltar="/cadastro/dados" /><Carregando /></>;
  const bloqueado = !podeEditar(p.solicitacao.status);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const placaLimpa = f.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErros({});
    try {
      await salvar.mutateAsync({ ...f, placa: placaLimpa });
      nav('/cadastro/documentos');
    } catch (e) {
      if (e instanceof ErroApi && e.campos) setErros(Object.fromEntries(e.campos.map((c) => [c.campo, c.erro])));
    }
  }

  return (
    <>
      <Topo titulo="Sua moto" voltar="/cadastro/dados" />
      <Etapas atual={1} feitas={[p.progresso.dados, p.progresso.moto, p.progresso.documentos, false]} />
      <form onSubmit={enviar} className="flex flex-col gap-5 p-5" noValidate>
        {salvar.error && !Object.keys(erros).length && <Aviso tom="erro">{salvar.error.message}</Aviso>}
        <fieldset disabled={bloqueado} className="cartao flex flex-col gap-4">
          <div className="flex justify-center py-2" aria-hidden>
            <Placa placa={placaLimpa || 'AAA0A00'} grande />
          </div>
          <Campo rotulo="Placa" dica="Mercosul (ABC1D23) ou modelo antigo (ABC1234)." erro={erros.placa}>
            <input className="entrada font-cond text-xl uppercase tracking-widest" value={f.placa} maxLength={8} autoCapitalize="characters"
              onChange={set('placa')} aria-invalid={!!erros.placa} />
          </Campo>
          <Campo rotulo="RENAVAM (opcional)" dica="11 números, está no CRLV." erro={erros.renavam}>
            <input className="entrada" inputMode="numeric" value={f.renavam} maxLength={11} onChange={set('renavam')} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Marca" erro={erros.marca}>
              <select className="entrada" value={f.marca} onChange={set('marca')} aria-invalid={!!erros.marca}>
                <option value="">—</option>
                {MARCAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Modelo" erro={erros.modelo}>
              <input className="entrada" placeholder="CG 160" value={f.modelo} onChange={set('modelo')} aria-invalid={!!erros.modelo} />
            </Campo>
            <Campo rotulo="Ano" erro={erros.ano}>
              <input className="entrada" inputMode="numeric" maxLength={4} value={f.ano} onChange={set('ano')} aria-invalid={!!erros.ano} />
            </Campo>
            <Campo rotulo="Cor" erro={erros.cor}>
              <select className="entrada" value={f.cor} onChange={set('cor')} aria-invalid={!!erros.cor}>
                <option value="">—</option>
                {CORES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
          </div>
        </fieldset>
        {bloqueado ? (
          <button type="button" className="btn-secundario" onClick={() => nav('/painel')}>Voltar ao início</button>
        ) : (
          <button className="btn-primario" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar e continuar'}</button>
        )}
      </form>
    </>
  );
}
