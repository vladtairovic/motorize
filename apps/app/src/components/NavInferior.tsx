import { NavLink } from 'react-router';

const I = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  cred: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2.2" /><path d="M6 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14.5 10h4M14.5 13.5h3" /></>,
  avisos: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
  conta: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.8 1.6 7 5.2" /></>,
};

export function NavInferior({ avisos = 0 }: { avisos?: number }) {
  const itens = [
    { to: '/painel', rotulo: 'Início', icone: I.inicio },
    { to: '/credencial', rotulo: 'Credencial', icone: I.cred },
    { to: '/avisos', rotulo: 'Avisos', icone: I.avisos, badge: avisos },
    { to: '/conta', rotulo: 'Conta', icone: I.conta },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-linha bg-white safe-b" aria-label="Navegação principal">
      <ul className="grid grid-cols-4">
        {itens.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 pt-2 text-[13px] font-semibold ${isActive ? 'text-ink' : 'text-cinza'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-14 place-items-center rounded-full ${isActive ? 'bg-refletivo-100' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">{it.icone}</svg>
                  </span>
                  {it.rotulo}
                  {!!it.badge && (
                    <span className="absolute right-[22%] top-1 grid min-w-5 place-items-center rounded-full bg-erro px-1 text-[11px] text-white">{it.badge}</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
