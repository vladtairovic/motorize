import { useState } from 'react';
import { Link } from 'react-router';
import { podeEditar, usePainel, useSalvar } from '../../lib/hooks';
import { Aviso, Carregando, Etapas, Placa, Selo, Topo } from '../../components/ui';
import { ATIVIDADES, DOCS, dataBR } from '../../lib/util';

function Bloco({ titulo, editar, children }: { titulo: string; editar?: string; children: React.ReactNode }) {
  return (
    <section className="cartao">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-cond text-xl font-bold text-indigo">{titulo}</h2>
        {editar && <Link to={editar} className="btn-texto text-[15px]">Alterar</Link>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">{children}</dl>
    </section>
  );
}
const Item = ({ r, v }: { r: string; v?: React.ReactNode }) => (
  <>
    <dt className="text-cinza">{r}</dt>
    <dd className="font-medium">{v || '—'}</dd>
  </>
);

export function EtapaRevisar() {
  const { data: p, isLoading } = usePainel();
  const enviar = useSalvar<void>('/entregador/solicitacao/enviar', 'POST');
  const [enviado, setEnviado] = useState(false);

  if (isLoading || !p) return <><Topo titulo="Revisar" voltar="/cadastro/documentos" /><Carregando /></>;
  const e = p.entregador;
  const m = e.motocicleta;
  const editavel = podeEditar(p.solicitacao.status);
  const completo = p.progresso.dados && p.progresso.moto && p.progresso.documentos;

  if (enviado)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-ok text-4xl text-white" aria-hidden>✓</div>
        <h1 className="titulo-tela">Solicitação enviada</h1>
        <p className="max-w-xs text-cinza">
          Protocolo <b className="text-asfalto">{p.solicitacao.protocolo}</b>. A CTTU vai conferir seus documentos. Você recebe um aviso no app com o resultado.
        </p>
        <Link to="/painel" className="btn-primario w-full max-w-xs">Voltar ao início</Link>
      </main>
    );

  return (
    <div className="pb-6">
      <Topo titulo="Revisar e enviar" voltar="/cadastro/documentos" />
      <Etapas atual={3} feitas={[p.progresso.dados, p.progresso.moto, p.progresso.documentos, false]} />
      <div className="flex flex-col gap-4 p-5">
        {p.solicitacao.tipo === 'RENOVACAO' && p.solicitacao.status === 'RASCUNHO' && (
          <Aviso tom="info" titulo="Renovação">Confira se algo mudou. Os documentos já aceitos foram mantidos.</Aviso>
        )}
        <Bloco titulo="Seus dados" editar={editavel ? '/cadastro/dados' : undefined}>
          <Item r="Nome" v={e.nomeSocial ? `${e.nomeSocial} (${e.nome})` : e.nome} />
          <Item r="Nascimento" v={e.dataNascimento && dataBR(e.dataNascimento + 'T12:00')} />
          <Item r="Bairro" v={e.bairro} />
          <Item r="Atividade" v={e.tipoAtividade && ATIVIDADES[e.tipoAtividade]} />
          <Item r="CNH" v={e.cnhNumero && `${e.cnhCategoria} · vence ${dataBR(e.cnhValidade + 'T12:00')}`} />
        </Bloco>
        <Bloco titulo="Moto" editar={editavel ? '/cadastro/moto' : undefined}>
          <Item r="Placa" v={m && <Placa placa={m.placa} />} />
          <Item r="Modelo" v={m && `${m.marca} ${m.modelo} ${m.ano}`} />
          <Item r="Cor" v={m?.cor} />
        </Bloco>
        <Bloco titulo="Documentos" editar={editavel ? '/cadastro/documentos' : undefined}>
          {Object.entries(DOCS).map(([t, d]) => {
            const doc = p.documentos[t];
            return (
              <Item key={t} r={d.nome} v={!doc ? <Selo tom="erro">Falta</Selo> : doc.status === 'RECUSADO' ? <Selo tom="erro">Recusado</Selo> : <Selo tom={doc.status === 'ACEITO' ? 'ok' : 'info'}>{doc.status === 'ACEITO' ? 'Aceito' : 'Recebido'}</Selo>} />
            );
          })}
        </Bloco>
        {enviar.error && <Aviso tom="erro">{enviar.error.message}</Aviso>}
        {editavel ? (
          <>
            <p className="text-sm text-cinza">Ao enviar, você declara que as informações são verdadeiras.</p>
            <button className="btn-destaque text-lg" disabled={!completo || enviar.isPending} onClick={() => enviar.mutate(undefined, { onSuccess: () => setEnviado(true) })}>
              {enviar.isPending ? 'Enviando…' : p.solicitacao.status === 'PENDENCIA' ? 'Reenviar com as correções' : 'Enviar para análise'}
            </button>
          </>
        ) : (
          <Link to="/solicitacao" className="btn-secundario">Acompanhar solicitação</Link>
        )}
      </div>
    </div>
  );
}
