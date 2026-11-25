import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { sair, sessao, type Usuario } from '../lib/api';
import { PAPEIS } from '../lib/util';

type Item = { to: string; rotulo: string; papeis: Usuario['papel'][] };
const ITENS: Item[] = [
  { to: '/', rotulo: 'Visão geral', papeis: ['ADMIN', 'ANALISTA', 'GESTOR'] },
  { to: '/solicitacoes', rotulo: 'Solicitações', papeis: ['ADMIN', 'ANALISTA'] },
  { to: '/entregadores', rotulo: 'Entregadores', papeis: ['ADMIN', 'ANALISTA', 'GESTOR'] },
  { to: '/comunicados', rotulo: 'Comunicados', papeis: ['ADMIN', 'ANALISTA', 'GESTOR'] },
  { to: '/servidores', rotulo: 'Servidores', papeis: ['ADMIN'] },
  { to: '/auditoria', rotulo: 'Auditoria LGPD', papeis: ['ADMIN'] },
];

export function Layout() {
  const u = sessao.ler()!.usuario;
  const nav = useNavigate();
  const qc = useQueryClient();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-linha bg-white text-ink md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src="/icone.svg" alt="" className="h-9" />
          <div>
            <p className="font-cond text-xl font-extrabold leading-none">Motori<span className="text-motor">ze</span></p>
            <p className="mt-0.5 text-xs text-cinza">Painel municipal · Toritama</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3" aria-label="Seções">
          {ITENS.filter((i) => i.papeis.includes(u.papel)).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `rounded-full px-4 py-2.5 font-semibold ${isActive ? 'bg-ink text-white shadow-[inset_4px_0_0_var(--color-refletivo)]' : 'text-ink/70 hover:bg-neve hover:text-ink'}`
              }
            >
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-linha px-5 py-4">
          <p className="font-bold">{u.nome}</p>
          <p className="text-sm text-cinza">{PAPEIS[u.papel]}</p>
          <button
            className="mt-3 text-sm font-bold text-ink underline decoration-refletivo decoration-2 underline-offset-4 hover:decoration-motor"
            onClick={async () => { await sair(); qc.clear(); nav('/entrar', { replace: true }); }}
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegação compacta em telas pequenas (tablet do backoffice) */}
        <nav className="flex gap-1 overflow-x-auto border-b border-linha bg-white px-3 py-2 md:hidden">
          {ITENS.filter((i) => i.papeis.includes(u.papel)).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink/70'}`}>
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-[1320px] flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
