import { Link, Navigate } from 'react-router';
import { sessao } from '../lib/api';

const PASSOS = [
  { t: 'Crie sua conta', d: 'Só CPF, nome, telefone e uma senha.' },
  { t: 'Preencha e envie', d: 'Seus dados, a moto e fotos dos documentos. Dá para parar e continuar depois.' },
  { t: 'A CTTU confere', d: 'Se faltar algo, o app mostra exatamente o que corrigir.' },
  { t: 'Use a credencial', d: 'Aprovado, sua credencial com QR Code fica no celular, mesmo sem internet.' },
];

export function Inicio() {
  if (sessao.ler('entregador')) return <Navigate to="/painel" replace />;
  return (
    <main className="flex min-h-dvh flex-col">
      <section className="bg-white px-5 pb-8 pt-6">
        <img src="/logo.webp" alt="Motorize" className="mx-auto w-44 select-none" />
        <h1 className="mt-4 font-cond text-[34px] font-extrabold leading-[1.05] text-ink">
          Credencial oficial do entregador de Toritama
        </h1>
        <p className="mt-3 max-w-sm text-[17px] text-cinza">
          Cadastro gratuito na Prefeitura. Com a credencial, você comprova na hora que trabalha regularizado.
        </p>

        {/* Prévia da credencial — o objeto central do produto */}
        <div className="escuro costura mt-7 rounded-3xl p-5 text-white" aria-hidden>
          <p className="font-cond text-xs font-bold tracking-[0.14em] text-refletivo">PREFEITURA DE TORITAMA · CTTU</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-16 w-13 rounded-xl bg-white/10" />
            <div className="flex-1">
              <p className="font-cond text-xl font-bold leading-tight">Seu nome aqui</p>
              <p className="text-sm text-white/70">Entregador credenciado</p>
            </div>
            <div className="grid size-16 grid-cols-4 gap-0.5 rounded-lg bg-white p-1.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className={[0, 2, 5, 6, 9, 11, 12, 15, 3, 10].includes(i) ? 'bg-ink' : 'bg-transparent'} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 px-5 py-6">
        <Link to="/criar-conta" className="btn-destaque text-lg">Quero me credenciar</Link>
        <Link to="/entrar" className="btn-secundario">Já tenho conta</Link>
        <p className="mt-1 text-center text-sm text-cinza">Não pedimos dados bancários nem renda.</p>
      </section>

      <section className="px-5 pb-8">
        <h2 className="font-cond text-2xl font-bold text-ink">Como funciona</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {PASSOS.map((p, i) => (
            <li key={p.t} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-refletivo font-cond text-lg font-bold text-ink">{i + 1}</span>
              <div>
                <p className="font-semibold">{p.t}</p>
                <p className="text-[15px] text-cinza">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex flex-col gap-3 border-t border-linha px-5 py-5 safe-b text-[15px]">
        <Link to="/validar" className="btn-texto">Conferir a credencial de um entregador</Link>
        <Link to="/agente/entrar" className="btn-texto">Sou agente da CTTU</Link>
        <p className="text-sm text-cinza">Prefeitura de Toritama · CTTU</p>
      </footer>
    </main>
  );
}
