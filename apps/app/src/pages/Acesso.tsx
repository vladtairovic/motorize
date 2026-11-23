import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, sessao, ErroApi, type Sessao } from '../lib/api';
import { Aviso, Campo, Topo } from '../components/ui';
import { mascaraCpf, mascaraTel } from '../lib/util';

function useErros() {
  const [geral, setGeral] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  return {
    geral, campos,
    limpar() { setGeral(''); setCampos({}); },
    de(e: unknown) {
      if (e instanceof ErroApi && e.campos?.length) {
        setCampos(Object.fromEntries(e.campos.map((c) => [c.campo, c.erro])));
        setGeral('Confira os campos destacados.');
      } else setGeral(e instanceof Error ? e.message : 'Erro inesperado');
    },
  };
}

export function CriarConta() {
  const nav = useNavigate();
  const [f, setF] = useState({ cpf: '', nome: '', telefone: '', senha: '', aceiteTermo: false });
  const [verTermo, setVerTermo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const err = useErros();
  const termo = useQuery({ queryKey: ['termo'], queryFn: () => api('/auth/termo'), enabled: verTermo });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    err.limpar();
    setEnviando(true);
    try {
      const s = await api<Sessao>('/auth/entregador/cadastro', { method: 'POST', json: f });
      sessao.salvar('entregador', s);
      nav('/cadastro/dados', { replace: true });
    } catch (e) {
      err.de(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Topo titulo="Criar conta" voltar="/" />
      <form onSubmit={enviar} className="flex flex-col gap-5 p-5" noValidate>
        <p className="text-cinza">Leva menos de 1 minuto. Depois você completa o cadastro no seu tempo.</p>
        {err.geral && <Aviso tom="erro">{err.geral}</Aviso>}
        <Campo rotulo="CPF" erro={err.campos.cpf}>
          <input className="entrada" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={f.cpf}
            aria-invalid={!!err.campos.cpf} onChange={(e) => setF({ ...f, cpf: mascaraCpf(e.target.value) })} required />
        </Campo>
        <Campo rotulo="Nome completo" erro={err.campos.nome}>
          <input className="entrada" autoComplete="name" value={f.nome} aria-invalid={!!err.campos.nome}
            onChange={(e) => setF({ ...f, nome: e.target.value })} required />
        </Campo>
        <Campo rotulo="Celular com WhatsApp" dica="Usamos para avisos sobre o seu cadastro." erro={err.campos.telefone}>
          <input className="entrada" inputMode="tel" autoComplete="tel" placeholder="(81) 90000-0000" value={f.telefone}
            aria-invalid={!!err.campos.telefone} onChange={(e) => setF({ ...f, telefone: mascaraTel(e.target.value) })} required />
        </Campo>
        <Campo rotulo="Crie uma senha" dica="Pelo menos 6 caracteres." erro={err.campos.senha}>
          <input className="entrada" type="password" autoComplete="new-password" value={f.senha} aria-invalid={!!err.campos.senha}
            onChange={(e) => setF({ ...f, senha: e.target.value })} required />
        </Campo>

        <div className="rounded-xl bg-white p-4 ring-1 ring-linha">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-6 accent-indigo" checked={f.aceiteTermo}
              onChange={(e) => setF({ ...f, aceiteTermo: e.target.checked })} />
            <span className="text-[15px]">
              Concordo que a Prefeitura use meus dados para o cadastro e a credencial, como explica o termo.
            </span>
          </label>
          <button type="button" className="btn-texto mt-2 text-[15px]" onClick={() => setVerTermo(!verTermo)}>
            {verTermo ? 'Esconder termo' : 'Ler o termo de uso de dados'}
          </button>
          {verTermo && termo.data && (
            <div className="mt-3 space-y-2 border-t border-linha pt-3 text-[15px]">
              <p><b>Para que:</b> {termo.data.finalidade}</p>
              <p><b>O que pedimos:</b> {termo.data.dadosColetados.join('; ')}.</p>
              <p><b>O que nunca pedimos:</b> {termo.data.naoColetados.join('; ')}.</p>
              <p><b>Por quanto tempo:</b> {termo.data.retencao}</p>
              <p><b>Seus direitos:</b> {termo.data.direitos}</p>
              <p className="text-sm text-cinza">{termo.data.baseLegal} Versão {termo.data.versao}.</p>
            </div>
          )}
          {err.campos.aceiteTermo && <p className="erro-campo mt-2">{err.campos.aceiteTermo}</p>}
        </div>

        <button className="btn-primario" disabled={enviando}>{enviando ? 'Criando conta…' : 'Criar conta'}</button>
        <p className="text-center text-[15px]">Já tem conta? <Link to="/entrar" className="btn-texto">Entrar</Link></p>
      </form>
    </>
  );
}

export function Entrar() {
  const nav = useNavigate();
  const [f, setF] = useState({ cpf: '', senha: '' });
  const [enviando, setEnviando] = useState(false);
  const err = useErros();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    err.limpar();
    setEnviando(true);
    try {
      sessao.salvar('entregador', await api<Sessao>('/auth/entregador/login', { method: 'POST', json: f }));
      nav('/painel', { replace: true });
    } catch (e) {
      err.de(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Topo titulo="Entrar" voltar="/" />
      <form onSubmit={enviar} className="flex flex-col gap-5 p-5" noValidate>
        {err.geral && <Aviso tom="erro">{err.geral}</Aviso>}
        <Campo rotulo="CPF" erro={err.campos.cpf}>
          <input className="entrada" inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} autoComplete="username"
            onChange={(e) => setF({ ...f, cpf: mascaraCpf(e.target.value) })} />
        </Campo>
        <Campo rotulo="Senha">
          <input className="entrada" type="password" autoComplete="current-password" value={f.senha}
            onChange={(e) => setF({ ...f, senha: e.target.value })} />
        </Campo>
        <button className="btn-primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-[15px] text-cinza">Esqueceu a senha? Procure a CTTU com documento com foto para redefinir.</p>
        <p className="text-center text-[15px]">Ainda não tem conta? <Link to="/criar-conta" className="btn-texto">Criar conta</Link></p>
      </form>
    </>
  );
}
