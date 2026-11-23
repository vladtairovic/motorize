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
      <aside className="denim sticky top-0 hidden h-dvh w-60 shrink-0 flex-col text-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src="/icone.svg" alt="" className="h-9" />
          <div>
            <p className="font-cond text-xl font-bold leading-none">MOTORIZE</p>
            <p className="text-xs text-white/70">Painel municipal · Toritama</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3" aria-label="Seções">
          {ITENS.filter((i) => i.papeis.includes(u.papel)).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 font-medium ${isActive ? 'bg-white/12 text-white shadow-[inset_3px_0_0_var(--color-refletivo)]' : 'text-white/75 hover:bg-white/6 hover:text-white'}`
              }
            >
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-4">
          <p className="font-semibold">{u.nome}</p>
          <p className="text-sm text-white/70">{PAPEIS[u.papel]}</p>
          <button
            className="mt-3 text-sm font-semibold text-refletivo hover:underline"
            onClick={async () => { await sair(); qc.clear(); nav('/entrar', { replace: true }); }}
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegação compacta em telas pequenas (tablet do backoffice) */}
        <nav className="denim flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
          {ITENS.filter((i) => i.papeis.includes(u.papel)).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-white/15 text-white' : 'text-white/75'}`}>
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
