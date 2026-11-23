import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, sair } from '../../lib/api';
import { bd } from '../../lib/offline';
import { usePainel } from '../../lib/hooks';
import { Aviso, Topo } from '../../components/ui';
import { NavInferior } from '../../components/NavInferior';
import { mascaraCpf, mascaraTel } from '../../lib/util';

export function MinhaConta() {
  const { data: p } = usePainel();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');

  async function encerrarSessao() {
    await sair('entregador');
    await bd.meta.delete('minhaCredencial');
    qc.clear();
    nav('/', { replace: true });
  }

  async function baixarDados() {
    setErro('');
    try {
      const dados = await api('/entregador/meus-dados', { perfil: 'entregador' });
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'meus-dados-motorize.json' });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function excluir() {
    try {
      await api('/entregador/conta', { method: 'DELETE', perfil: 'entregador' });
      await encerrarSessao();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="pb-28">
      <Topo titulo="Minha conta" voltar="/painel" />
      <main className="flex flex-col gap-4 p-4">
        {p && (
          <section className="cartao text-[15px]">
            <p className="font-cond text-2xl font-bold text-indigo">{p.entregador.nome}</p>
            <p className="text-cinza">CPF {mascaraCpf(p.entregador.cpf)}</p>
            <p className="text-cinza">{mascaraTel(p.entregador.telefone)}</p>
          </section>
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        <section className="cartao flex flex-col gap-3">
          <h2 className="font-cond text-xl font-bold text-indigo">Seus dados, seus direitos</h2>
          <p className="text-[15px] text-cinza">
            A Prefeitura só usa seus dados para o cadastro, a credencial e estatísticas sem identificação. Cada acesso de servidor aos seus documentos fica registrado.
          </p>
          <button className="btn-secundario" onClick={baixarDados}>Baixar uma cópia dos meus dados</button>
          {!confirmar ? (
            <button className="btn-texto self-start text-erro" onClick={() => setConfirmar(true)}>Excluir minha conta</button>
          ) : (
            <div className="rounded-xl bg-erro-100 p-4">
              <p className="font-semibold text-erro">Excluir sua conta?</p>
              <p className="mt-1 text-[15px]">Sua credencial é revogada na hora e seus dados pessoais são apagados. Só fica o registro anônimo exigido para auditoria. Isso não pode ser desfeito.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
                <button className="btn bg-erro text-white" onClick={excluir}>Excluir conta</button>
              </div>
            </div>
          )}
        </section>

        <button className="btn-secundario" onClick={encerrarSessao}>Sair deste celular</button>
      </main>
      <NavInferior avisos={p?.notificacoesNaoLidas} />
    </div>
  );
}
