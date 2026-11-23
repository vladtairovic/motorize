import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { api, sessao, type Sessao } from '../../lib/api';
import { Aviso, Campo, Topo } from '../../components/ui';

export function AgenteEntrar() {
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (sessao.ler('agente')) return <Navigate to="/agente" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const s = await api<Sessao>('/auth/servidor/login', { method: 'POST', json: f });
      if (!['AGENTE', 'ADMIN'].includes(s.usuario.papel ?? '')) throw new Error('Este acesso é exclusivo para agentes de fiscalização. Analistas usam o painel municipal.');
      sessao.salvar('agente', s);
      nav('/agente', { replace: true });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Topo titulo="Acesso do agente" voltar="/" />
      <form onSubmit={enviar} className="flex flex-col gap-5 p-5">
        <p className="text-cinza">Para agentes da CTTU. Depois de entrar, o app baixa os dados para conferir credenciais mesmo sem sinal.</p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo rotulo="E-mail institucional">
          <input className="entrada" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Campo>
        <Campo rotulo="Senha">
          <input className="entrada" type="password" autoComplete="current-password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} />
        </Campo>
        <button className="btn-primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </>
  );
}
