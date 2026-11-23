import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cabecalho, Carregando } from '../components/ui';
import { dataHoraBR } from '../lib/util';

const ACOES: Record<string, string> = {
  LOGIN: 'Entrou no painel', CONTA_CRIADA: 'Criou conta', VISUALIZOU_SOLICITACAO: 'Abriu solicitação', VISUALIZOU_ENTREGADOR: 'Abriu ficha do entregador',
  ABRIU_DOCUMENTO: 'Abriu documento', DOCUMENTO_ACEITO: 'Aceitou documento', DOCUMENTO_RECUSADO: 'Recusou documento',
  SOLICITACAO_APROVADA: 'Aprovou solicitação', SOLICITACAO_PENDENCIA: 'Devolveu com pendência', SOLICITACAO_REPROVADA: 'Reprovou solicitação',
  CREDENCIAL_SUSPENSA: 'Suspendeu credencial', CREDENCIAL_ATIVA: 'Reativou credencial', CREDENCIAL_REVOGADA: 'Revogou credencial',
  COMUNICADO_ENVIADO: 'Enviou comunicado', SERVIDOR_CRIADO: 'Cadastrou servidor', SERVIDOR_ATIVADO: 'Reativou servidor', SERVIDOR_DESATIVADO: 'Desativou servidor',
  BAIXOU_PACOTE_OFFLINE: 'Baixou pacote offline', EXPORTOU_PROPRIOS_DADOS: 'Exportou os próprios dados', ANONIMIZACAO_SOLICITADA: 'Pediu exclusão dos dados',
};

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['auditoria', pagina], queryFn: () => api<any[]>(`/admin/auditoria?pagina=${pagina}`), placeholderData: keepPreviousData });
  return (
    <>
      <Cabecalho titulo="Auditoria LGPD" sub="Registro de quem acessou ou alterou dados pessoais (LGPD, art. 37). Não pode ser editado." />
      <div className="painel overflow-x-auto">
        {isLoading ? <Carregando /> : (
          <table className="tabela text-sm">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th><th>IP</th></tr></thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{dataHoraBR(a.criado_em)}</td>
                  <td>{a.ator_nome}<span className="block text-[12px] text-cinza">{a.ator_tipo.toLowerCase()}</span></td>
                  <td>{ACOES[a.acao] ?? a.acao}{a.detalhes?.tipo && <span className="text-cinza"> · {a.detalhes.tipo}</span>}</td>
                  <td className="font-mono text-[12px] text-cinza">{a.entidade}{a.entidade_id ? ` ${a.entidade_id.slice(0, 8)}` : ''}</td>
                  <td className="text-cinza">{a.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end gap-2 p-3">
          <button className="btn-secundario" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Mais recentes</button>
          <button className="btn-secundario" disabled={(data?.length ?? 0) < 50} onClick={() => setPagina(pagina + 1)}>Mais antigos</button>
        </div>
      </div>
    </>
  );
}
