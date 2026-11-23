import { useSyncExternalStore, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { sessao, type Perfil } from './lib/api';
import { FaixaOffline } from './components/ui';
import { Inicio } from './pages/Inicio';
import { CriarConta, Entrar } from './pages/Acesso';
import { Painel } from './pages/entregador/Painel';
import { EtapaDados } from './pages/entregador/EtapaDados';
import { EtapaMoto } from './pages/entregador/EtapaMoto';
import { EtapaDocumentos } from './pages/entregador/EtapaDocumentos';
import { EtapaRevisar } from './pages/entregador/EtapaRevisar';
import { Acompanhar } from './pages/entregador/Acompanhar';
import { MinhaCredencial } from './pages/entregador/MinhaCredencial';
import { Avisos } from './pages/entregador/Avisos';
import { MinhaConta } from './pages/entregador/MinhaConta';
import { ValidarPublico } from './pages/ValidarPublico';
import { AgenteEntrar } from './pages/agente/AgenteEntrar';
import { Campo } from './pages/agente/Campo';

function useSessao(p: Perfil) {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('motorize:sessao', cb);
      window.addEventListener('storage', cb);
      return () => {
        window.removeEventListener('motorize:sessao', cb);
        window.removeEventListener('storage', cb);
      };
    },
    () => localStorage.getItem(`motorize.sessao.${p}`),
  );
}

function Protegida({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  useSessao(perfil);
  if (!sessao.ler(perfil)) return <Navigate to={perfil === 'agente' ? '/agente/entrar' : '/entrar'} replace />;
  return <>{children}</>;
}

export function App() {
  const ent = (el: ReactNode) => <Protegida perfil="entregador">{el}</Protegida>;
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-papel">
      <FaixaOffline />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/validar" element={<ValidarPublico />} />

        <Route path="/painel" element={ent(<Painel />)} />
        <Route path="/cadastro/dados" element={ent(<EtapaDados />)} />
        <Route path="/cadastro/moto" element={ent(<EtapaMoto />)} />
        <Route path="/cadastro/documentos" element={ent(<EtapaDocumentos />)} />
        <Route path="/cadastro/revisar" element={ent(<EtapaRevisar />)} />
        <Route path="/solicitacao" element={ent(<Acompanhar />)} />
        <Route path="/credencial" element={ent(<MinhaCredencial />)} />
        <Route path="/avisos" element={ent(<Avisos />)} />
        <Route path="/conta" element={ent(<MinhaConta />)} />

        <Route path="/agente/entrar" element={<AgenteEntrar />} />
        <Route path="/agente" element={<Protegida perfil="agente"><Campo /></Protegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
