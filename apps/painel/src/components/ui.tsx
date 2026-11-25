import type { ReactNode } from 'react';
import { STATUS_SOL } from '../lib/util';

export function Status({ s }: { s: string }) {
  const st = STATUS_SOL[s] ?? { rotulo: s, cls: 'bg-linha' };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${st.cls}`}>{st.rotulo}</span>;
}

export function Cabecalho({ titulo, sub, acoes }: { titulo: string; sub?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-cond text-[32px] font-bold leading-none text-ink">{titulo}</h1>
        {sub && <p className="mt-1.5 text-cinza">{sub}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Erro({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-lg border-l-4 border-erro bg-erro-100 px-4 py-3 text-erro">{children}</div>;
}

export function Carregando() {
  return (
    <div className="grid min-h-60 place-items-center" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-linha border-t-ink" aria-label="Carregando" />
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-12 text-center text-cinza">{children}</p>;
}

export function Paginacao({ pagina, total, porPagina, onMudar }: { pagina: number; total: number; porPagina: number; onMudar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-cinza">
      <span>{total} registro(s)</span>
      <div className="flex items-center gap-2">
        <button className="btn-secundario" disabled={pagina <= 1} onClick={() => onMudar(pagina - 1)}>Anterior</button>
        <span>{pagina} de {paginas}</span>
        <button className="btn-secundario" disabled={pagina >= paginas} onClick={() => onMudar(pagina + 1)}>Próxima</button>
      </div>
    </div>
  );
}

export function Dado({ r, v }: { r: string; v?: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-cinza">{r}</dt>
      <dd className="font-medium">{v || '—'}</dd>
    </div>
  );
}

export function Placa({ placa }: { placa?: string | null }) {
  if (!placa) return <>—</>;
  return (
    <span className="inline-flex flex-col overflow-hidden rounded border-[1.5px] border-asfalto bg-white font-cond text-[15px] font-bold leading-none">
      <span className="bg-[#003399] text-center text-[7px] leading-[9px] tracking-[0.2em] text-white">BRASIL</span>
      <span className="px-1.5 py-0.5 tracking-wider">{placa}</span>
    </span>
  );
}

export function Modal({ titulo, children, onFechar }: { titulo: string; children: ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-asfalto/50 p-4" onClick={onFechar} role="dialog" aria-modal aria-label={titulo}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-cond text-2xl font-bold text-ink">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
