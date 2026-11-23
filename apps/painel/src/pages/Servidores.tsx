import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cabecalho, Carregando, Erro, Modal } from '../components/ui';
import { PAPEIS, dataHoraBR } from '../lib/util';

export function Servidores() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['servidores'], queryFn: () => api<any[]>('/admin/servidores') });
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: '', email: '', senha: '', papel: 'ANALISTA', matricula: '', orgao: 'CTTU' });
  const criar = useMutation({
    mutationFn: () => api('/admin/servidores', { method: 'POST', json: f }),
    onSuccess: () => { setNovo(false); setF({ nome: '', email: '', senha: '', papel: 'ANALISTA', matricula: '', orgao: 'CTTU' }); qc.invalidateQueries({ queryKey: ['servidores'] }); },
  });
  const alternar = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => api(`/admin/servidores/${v.id}`, { method: 'PATCH', json: { ativo: v.ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servidores'] }),
  });

  return (
    <>
      <Cabecalho titulo="Servidores" sub="Quem acessa o painel e o modo agente." acoes={<button className="btn-primario" onClick={() => setNovo(true)}>Adicionar servidor</button>} />
      {alternar.error && <div className="mb-4"><Erro>{alternar.error.message}</Erro></div>}
      <div className="painel overflow-x-auto">
        {isLoading ? <Carregando /> : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Órgão</th><th>Perfil</th><th>Último acesso</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {data?.map((s) => (
                <tr key={s.id} className={s.ativo ? '' : 'opacity-55'}>
                  <td className="font-medium">{s.nome}<span className="block text-[13px] text-cinza">Mat. {s.matricula ?? '—'}</span></td>
                  <td>{s.email}</td>
                  <td>{s.orgao}</td>
                  <td>{PAPEIS[s.papel]}</td>
                  <td className="text-cinza">{dataHoraBR(s.ultimoAcessoEm)}</td>
                  <td>{s.ativo ? 'Ativo' : 'Desativado'}</td>
                  <td className="text-right"><button className="btn-secundario" onClick={() => alternar.mutate({ id: s.id, ativo: !s.ativo })}>{s.ativo ? 'Desativar' : 'Reativar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {novo && (
        <Modal titulo="Adicionar servidor" onFechar={() => setNovo(false)}>
          <div className="space-y-3">
            {criar.error && <Erro>{criar.error.message}</Erro>}
            <label className="block"><span className="rotulo">Nome</span><input className="entrada" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></label>
            <label className="block"><span className="rotulo">E-mail institucional</span><input className="entrada" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="rotulo">Perfil</span>
                <select className="entrada" value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })}>
                  {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="block"><span className="rotulo">Matrícula</span><input className="entrada" value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value })} /></label>
            </div>
            <label className="block"><span className="rotulo">Órgão</span><input className="entrada" value={f.orgao} onChange={(e) => setF({ ...f, orgao: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Senha inicial</span><input className="entrada" type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} /><span className="text-[13px] text-cinza">Mínimo de 8 caracteres.</span></label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secundario" onClick={() => setNovo(false)}>Cancelar</button>
              <button className="btn-primario" disabled={criar.isPending} onClick={() => criar.mutate()}>Adicionar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
