import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { podeEditar, usePainel, useSalvar } from '../../lib/hooks';
import { ErroApi } from '../../lib/api';
import { Aviso, Campo, Carregando, Etapas, Topo } from '../../components/ui';
import { ATIVIDADES, posicaoAtual } from '../../lib/util';

const BAIRROS = ['Centro', 'Parque das Feiras', 'São José', 'Bela Vista', 'Santa Maria', 'Vila Nova', 'Torres', 'Alto do Cruzeiro', 'Zona rural', 'Outro'];
const PLATAFORMAS = ['iFood', '99Food', 'Rappi', 'Keeta', 'Uber', 'Indrive', 'Comércio local'];

export function EtapaDados() {
  const { data: p, isLoading } = usePainel();
  const salvar = useSalvar('/entregador/dados');
  const nav = useNavigate();
  const [f, setF] = useState<any>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [localizando, setLocalizando] = useState(false);

  useEffect(() => {
    if (p && !f) {
      const e = p.entregador;
      setF({
        nomeSocial: e.nomeSocial ?? '', dataNascimento: e.dataNascimento ?? '', email: e.email ?? '',
        bairro: e.bairro ?? '', logradouro: e.logradouro ?? '', numero: e.numero ?? '',
        latitude: e.latitude, longitude: e.longitude,
        tipoAtividade: e.tipoAtividade ?? '', plataformas: e.plataformas ?? [],
        cnhNumero: e.cnhNumero ?? '', cnhCategoria: e.cnhCategoria ?? '', cnhValidade: e.cnhValidade ?? '',
      });
    }
  }, [p, f]);

  if (isLoading || !f || !p) return <><Topo titulo="Seus dados" voltar="/painel" /><Carregando /></>;
  const bloqueado = !podeEditar(p.solicitacao.status);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErros({});
    try {
      await salvar.mutateAsync({ ...f, nomeSocial: f.nomeSocial || null, email: f.email || null });
      nav('/cadastro/moto');
    } catch (e) {
      if (e instanceof ErroApi && e.campos) setErros(Object.fromEntries(e.campos.map((c) => [c.campo, c.erro])));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function localizar() {
    setLocalizando(true);
    const pos = await posicaoAtual(8000);
    setLocalizando(false);
    if (pos) setF({ ...f, ...pos });
  }

  return (
    <>
      <Topo titulo="Seus dados" voltar="/painel" />
      <Etapas atual={0} feitas={[p.progresso.dados, p.progresso.moto, p.progresso.documentos, false]} />
      <form onSubmit={enviar} className="flex flex-col gap-5 p-5" noValidate>
        {bloqueado && <Aviso tom="info">Sua solicitação já foi enviada. Os dados ficam só para consulta.</Aviso>}
        {salvar.error && <Aviso tom="erro">{Object.keys(erros).length ? 'Confira os campos destacados.' : salvar.error.message}</Aviso>}

        <fieldset disabled={bloqueado} className="flex flex-col gap-5">
          <div className="cartao flex flex-col gap-4">
            <p className="text-sm text-cinza">Nome: <b className="text-asfalto">{p.entregador.nome}</b></p>
            <Campo rotulo="Nome social (opcional)" dica="Se preferir ser chamado por outro nome na credencial.">
              <input className="entrada" value={f.nomeSocial} onChange={set('nomeSocial')} />
            </Campo>
            <Campo rotulo="Data de nascimento" erro={erros.dataNascimento}>
              <input className="entrada" type="date" value={f.dataNascimento} onChange={set('dataNascimento')} aria-invalid={!!erros.dataNascimento} />
            </Campo>
            <Campo rotulo="E-mail (opcional)" erro={erros.email}>
              <input className="entrada" type="email" inputMode="email" value={f.email} onChange={set('email')} />
            </Campo>
          </div>

          <div className="cartao flex flex-col gap-4">
            <p className="font-cond text-xl font-bold text-ink">Onde você mora ou trabalha</p>
            <Campo rotulo="Bairro" erro={erros.bairro}>
              <select className="entrada" value={f.bairro} onChange={set('bairro')} aria-invalid={!!erros.bairro}>
                <option value="">Escolha…</option>
                {BAIRROS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Campo rotulo="Rua">
                <input className="entrada" value={f.logradouro} onChange={set('logradouro')} autoComplete="address-line1" />
              </Campo>
              <Campo rotulo="Número">
                <input className="entrada" value={f.numero} onChange={set('numero')} inputMode="numeric" />
              </Campo>
            </div>
            <div className="rounded-xl bg-papel p-3 text-[15px]">
              <p className="text-cinza">
                Opcional: marcar sua localização ajuda a Prefeitura a planejar pontos de apoio. No painel aparece só agrupado por região, nunca o seu ponto exato.
              </p>
              {f.latitude ? (
                <p className="mt-2 font-semibold text-ok">Localização marcada ✓ <button type="button" className="btn-texto ml-2" onClick={() => setF({ ...f, latitude: null, longitude: null })}>Remover</button></p>
              ) : (
                <button type="button" className="btn-texto mt-2" onClick={localizar} disabled={localizando}>
                  {localizando ? 'Buscando…' : 'Usar minha localização atual'}
                </button>
              )}
            </div>
          </div>

          <div className="cartao flex flex-col gap-4">
            <p className="font-cond text-xl font-bold text-ink">Seu trabalho</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[15px] font-semibold">Como você trabalha principalmente?</legend>
              {Object.entries(ATIVIDADES).map(([k, v]) => (
                <label key={k} className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 ${f.tipoAtividade === k ? 'border-ink bg-neve' : 'border-linha bg-white'}`}>
                  <input type="radio" name="ativ" className="size-5 accent-ink" checked={f.tipoAtividade === k} onChange={() => setF({ ...f, tipoAtividade: k })} />
                  {v}
                </label>
              ))}
              {erros.tipoAtividade && <p className="erro-campo">Escolha uma opção</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[15px] font-semibold">Plataformas que você usa (opcional)</legend>
              <div className="flex flex-wrap gap-2">
                {PLATAFORMAS.map((pl) => {
                  const on = f.plataformas.includes(pl);
                  return (
                    <button type="button" key={pl} aria-pressed={on}
                      onClick={() => setF({ ...f, plataformas: on ? f.plataformas.filter((x: string) => x !== pl) : [...f.plataformas, pl] })}
                      className={`min-h-11 rounded-full border-2 px-4 text-[15px] font-medium ${on ? 'border-ink bg-ink text-white' : 'border-linha bg-white'}`}>
                      {pl}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="cartao flex flex-col gap-4">
            <p className="font-cond text-xl font-bold text-ink">Sua CNH</p>
            <Campo rotulo="Número da CNH (registro)" dica="Os 11 números do campo “Nº registro”." erro={erros.cnhNumero}>
              <input className="entrada" inputMode="numeric" value={f.cnhNumero} onChange={set('cnhNumero')} maxLength={14} aria-invalid={!!erros.cnhNumero} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Categoria" erro={erros.cnhCategoria}>
                <select className="entrada" value={f.cnhCategoria} onChange={set('cnhCategoria')} aria-invalid={!!erros.cnhCategoria}>
                  <option value="">—</option>
                  {['A', 'AB', 'AC', 'AD', 'AE'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Validade" erro={erros.cnhValidade}>
                <input className="entrada" type="date" value={f.cnhValidade} onChange={set('cnhValidade')} aria-invalid={!!erros.cnhValidade} />
              </Campo>
            </div>
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
