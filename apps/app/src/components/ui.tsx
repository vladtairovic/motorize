import { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import QRCode from 'qrcode';
import { formatarPlaca } from '../lib/util';

export function Marca({ claro = false, tamanho = 'md' }: { claro?: boolean; tamanho?: 'md' | 'lg' }) {
  const h = tamanho === 'lg' ? 'h-12' : 'h-8';
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/icone.svg" alt="" className={h} />
      <span className={`font-cond font-bold tracking-wide ${tamanho === 'lg' ? 'text-4xl' : 'text-2xl'} ${claro ? 'text-white' : 'text-indigo'}`}>
        MOTORIZE
      </span>
    </span>
  );
}

export function Topo({ titulo, voltar, acao }: { titulo?: string; voltar?: string | true; acao?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-indigo px-2 text-white">
      {voltar ? (
        <button
          onClick={() => (voltar === true ? nav(-1) : nav(voltar))}
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          aria-label="Voltar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      ) : (
        <Link to="/" className="px-2" aria-label="Início">
          <Marca claro />
        </Link>
      )}
      {titulo && <h1 className="flex-1 truncate font-cond text-xl font-semibold">{titulo}</h1>}
      {!titulo && <span className="flex-1" />}
      {acao}
    </header>
  );
}

const TONS = {
  neutro: 'bg-linha/60 text-asfalto',
  info: 'bg-lavado-100 text-indigo',
  alerta: 'bg-alerta-100 text-alerta',
  ok: 'bg-ok-100 text-ok',
  erro: 'bg-erro-100 text-erro',
};
export type Tom = keyof typeof TONS;

export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${TONS[tom]}`}>{children}</span>;
}

export function Aviso({ tom = 'info', titulo, children }: { tom?: Tom; titulo?: string; children?: ReactNode }) {
  const borda = { neutro: 'border-linha', info: 'border-lavado', alerta: 'border-alerta', ok: 'border-ok', erro: 'border-erro' }[tom];
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={`rounded-xl border-l-4 ${borda} ${TONS[tom]} px-4 py-3`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className="text-[15px] leading-snug whitespace-pre-line">{children}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center text-cinza" role="status">
      <div className="flex flex-col items-center gap-3">
        <span className="size-9 animate-spin rounded-full border-4 border-linha border-t-indigo" />
        {texto}
      </div>
    </div>
  );
}

export function Campo({ rotulo, dica, erro, children }: { rotulo: string; dica?: string; erro?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {erro ? <p className="erro-campo">{erro}</p> : dica ? <small>{dica}</small> : null}
    </label>
  );
}

/** Etapas do cadastro: é de fato uma sequência, por isso numerada. */
export function Etapas({ atual, feitas }: { atual: number; feitas: boolean[] }) {
  const nomes = ['Seus dados', 'Moto', 'Documentos', 'Revisar'];
  return (
    <ol className="flex gap-1.5 px-4 pt-4" aria-label="Etapas do cadastro">
      {nomes.map((n, i) => {
        const ativo = i === atual;
        const ok = feitas[i];
        return (
          <li key={n} className="flex-1" aria-current={ativo ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${ok ? 'bg-ok' : ativo ? 'bg-indigo' : 'bg-linha'}`} />
            <p className={`mt-1.5 text-xs font-semibold ${ativo ? 'text-indigo' : 'text-cinza'}`}>
              {i + 1}. {n}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function Qr({ valor, tamanho = 260 }: { valor: string; tamanho?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(valor, { errorCorrectionLevel: 'M', margin: 1, width: tamanho * 2, color: { dark: '#1E2A5A', light: '#FFFFFF' } }).then(setSrc);
  }, [valor, tamanho]);
  return src ? <img src={src} width={tamanho} height={tamanho} alt="QR Code da credencial" className="block" /> : <div style={{ width: tamanho, height: tamanho }} />;
}

export function Placa({ placa, grande = false }: { placa?: string | null; grande?: boolean }) {
  return (
    <span className={`placa ${grande ? 'text-3xl' : 'text-lg'}`}>
      <span className={`px-2.5 tracking-wider ${grande ? 'py-0.5' : ''}`}>{formatarPlaca(placa)}</span>
    </span>
  );
}

export function FotoPessoa({ src, nome, className = '' }: { src?: string | null; nome: string; className?: string }) {
  return src ? (
    <img src={src} alt={`Foto de ${nome}`} className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-lavado-100 font-cond text-4xl font-bold text-lavado ${className}`} aria-label="Sem foto">
      {nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}
    </div>
  );
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

export function FaixaOffline() {
  const on = useOnline();
  if (on) return null;
  return (
    <div className="bg-asfalto px-4 py-2 text-center text-sm font-medium text-white" role="status">
      Sem internet. O que já foi carregado continua disponível.
    </div>
  );
}
