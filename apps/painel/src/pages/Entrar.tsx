import { useState, type FormEvent } from 'react';
import { api, sessao, type Sessao } from '../lib/api';
import { Erro } from '../components/ui';

export function Entrar() {
  const [f, setF] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const s = await api<Sessao>('/auth/servidor/login', { method: 'POST', json: f });
      if (s.usuario.papel === 'AGENTE') throw new Error('Agentes de campo usam o app MOTORIZE no celular (modo agente).');
      sessao.salvar(s); // a rota /entrar redireciona conforme o perfil
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="denim relative hidden flex-col justify-between p-12 text-white md:flex">
        <div className="flex items-center gap-3">
          <img src="/icone.svg" alt="" className="h-11" />
          <span className="font-cond text-3xl font-bold">MOTORIZE</span>
        </div>
        <div>
          <p className="max-w-md font-cond text-5xl font-bold leading-[0.98]">Cadastro municipal dos motociclistas de entrega</p>
          <p className="mt-4 max-w-md text-white/80">Análise documental, credenciamento e indicadores para a CTTU e a Prefeitura de Toritama.</p>
        </div>
        <p className="text-sm text-white/60">Acesso restrito a servidores. Todas as ações ficam registradas (LGPD).</p>
      </section>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-cond text-3xl font-bold text-indigo">Entrar no painel</h1>
            <p className="mt-1 text-cinza">Use seu e-mail institucional.</p>
          </div>
          {erro && <Erro>{erro}</Erro>}
          <label className="block">
            <span className="rotulo">E-mail</span>
            <input className="entrada" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </label>
          <label className="block">
            <span className="rotulo">Senha</span>
            <input className="entrada" type="password" autoComplete="current-password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} required />
          </label>
          <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </main>
    </div>
  );
}
