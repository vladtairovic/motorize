import { StrictMode, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { sessao, type Usuario } from './lib/api';
import { Layout } from './components/Layout';
import { Entrar } from './pages/Entrar';
import { VisaoGeral } from './pages/VisaoGeral';
import { Solicitacoes } from './pages/Solicitacoes';
import { Analise } from './pages/Analise';
import { Entregadores } from './pages/Entregadores';
import { Entregador } from './pages/Entregador';
import { Comunicados } from './pages/Comunicados';
import { Servidores } from './pages/Servidores';
import { Auditoria } from './pages/Auditoria';
import './styles.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

function useLogado() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('motorize:sessao', cb); return () => window.removeEventListener('motorize:sessao', cb); },
    () => localStorage.getItem('motorize.painel.sessao'),
  );
}

function Exige({ papeis, children }: { papeis?: Usuario['papel'][]; children: ReactNode }) {
  const u = sessao.ler()?.usuario;
  if (papeis && u && !papeis.includes(u.papel) && u.papel !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  useLogado();
  const logado = !!sessao.ler();
  return (
    <Routes>
      <Route path="/entrar" element={logado ? <Navigate to={sessao.ler()!.usuario.papel === 'ANALISTA' ? '/solicitacoes' : '/'} replace /> : <Entrar />} />
      <Route element={logado ? <Layout /> : <Navigate to="/entrar" replace />}>
        <Route index element={<VisaoGeral />} />
        <Route path="solicitacoes" element={<Exige papeis={['ANALISTA']}><Solicitacoes /></Exige>} />
        <Route path="solicitacoes/:id" element={<Exige papeis={['ANALISTA']}><Analise /></Exige>} />
        <Route path="entregadores" element={<Entregadores />} />
        <Route path="entregadores/:id" element={<Exige papeis={['ANALISTA']}><Entregador /></Exige>} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="servidores" element={<Exige papeis={['ADMIN']}><Servidores /></Exige>} />
        <Route path="auditoria" element={<Exige papeis={['ADMIN']}><Auditoria /></Exige>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
