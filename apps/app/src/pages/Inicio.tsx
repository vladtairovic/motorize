import { Link, Navigate } from 'react-router';
import { sessao } from '../lib/api';
import { Marca } from '../components/ui';

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
      <section className="denim relative overflow-hidden px-5 pb-10 pt-6 text-white">
        <Marca claro />
        <h1 className="mt-10 font-cond text-[44px] font-bold leading-[0.95]">
          Credencial oficial do entregador de Toritama
        </h1>
        <p className="mt-4 max-w-sm text-[17px] text-white/85">
          Cadastro gratuito na Prefeitura. Com a credencial, você comprova na hora que trabalha regularizado.
        </p>

        {/* Prévia da credencial — o objeto central do produto */}
        <div className="costura mt-8 rotate-[-2deg] rounded-2xl bg-white p-4 text-asfalto shadow-2xl" aria-hidden>
          <div className="flex items-center gap-3">
            <div className="h-16 w-13 rounded-lg bg-lavado-100" />
            <div className="flex-1">
              <p className="font-cond text-xl font-bold leading-tight text-indigo">Seu nome aqui</p>
              <p className="text-sm text-cinza">Entregador credenciado</p>
            </div>
            <div className="grid size-16 grid-cols-4 gap-0.5 rounded-md bg-white p-1 ring-1 ring-linha">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className={[0, 2, 5, 6, 9, 11, 12, 15, 3, 10].includes(i) ? 'bg-indigo' : 'bg-transparent'} />
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
        <h2 className="font-cond text-2xl font-bold text-indigo">Como funciona</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {PASSOS.map((p, i) => (
            <li key={p.t} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-refletivo font-cond text-lg font-bold text-indigo">{i + 1}</span>
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
