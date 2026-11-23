import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { podeEditar, usePainel } from '../../lib/hooks';
import { enviarArquivo, urlArquivo } from '../../lib/api';
import { Aviso, Carregando, Etapas, Selo, Topo } from '../../components/ui';
import { DOCS, reduzirImagem } from '../../lib/util';

type Doc = { id: string; status: string; motivoRecusa: string | null; mime: string } | undefined;

function CartaoDocumento({ tipo, doc, bloqueado }: { tipo: string; doc: Doc; bloqueado: boolean }) {
  const qc = useQueryClient();
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'ok' | 'erro'>('parado');
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState<string | null>(null);
  const info = DOCS[tipo];

  useEffect(() => {
    let url: string | null = null;
    if (doc && doc.mime.startsWith('image/'))
      urlArquivo(`/entregador/documentos/${doc.id}/arquivo`, 'entregador').then((u) => setPrevia((url = u))).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [doc?.id]);

  async function escolher(arquivo?: File) {
    if (!arquivo) return;
    setEstado('enviando');
    setErro('');
    try {
      const blob = arquivo.type === 'application/pdf' ? arquivo : await reduzirImagem(arquivo, tipo === 'FOTO' ? 720 : 1600);
      if (blob.size > 8 * 1024 * 1024) throw new Error('Arquivo muito grande (máx. 8 MB).');
      await enviarArquivo(`/entregador/documentos/${tipo}`, blob, arquivo.type === 'application/pdf' ? 'doc.pdf' : 'foto.jpg');
      setEstado('ok');
      await qc.invalidateQueries({ queryKey: ['painel'] });
    } catch (e) {
      setEstado('erro');
      setErro((e as Error).message);
    }
  }

  const recusado = doc?.status === 'RECUSADO';
  const selo = !doc ? null : doc.status === 'ACEITO' ? <Selo tom="ok">Aceito</Selo> : recusado ? <Selo tom="erro">Enviar de novo</Selo> : <Selo tom="info">Recebido</Selo>;

  return (
    <div className={`cartao flex flex-col gap-3 ${recusado ? 'ring-2 ring-erro/40' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-papel ring-1 ring-linha">
          {previa ? <img src={previa} alt="" className="size-full object-cover" /> : doc ? <span className="grid size-full place-items-center text-xs font-semibold text-cinza">PDF</span> : null}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{info.nome}</p>
            {selo}
          </div>
          <p className="mt-0.5 text-sm text-cinza">{info.dica}</p>
        </div>
      </div>
      {recusado && <Aviso tom="erro" titulo="Motivo">{doc!.motivoRecusa}</Aviso>}
      {estado === 'ok' && <p className="text-[15px] font-semibold text-ok" role="status">Recebido. Não precisa enviar de novo.</p>}
      {estado === 'erro' && <Aviso tom="erro">{erro}</Aviso>}
      {!bloqueado && doc?.status !== 'ACEITO' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={doc && !recusado ? 'btn-secundario' : 'btn-primario'} disabled={estado === 'enviando'} onClick={() => camera.current?.click()}>
            {estado === 'enviando' ? 'Enviando…' : doc && !recusado ? 'Trocar foto' : 'Tirar foto'}
          </button>
          <button type="button" className="btn-secundario" disabled={estado === 'enviando'} onClick={() => galeria.current?.click()}>
            Da galeria
          </button>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture={tipo === 'FOTO' ? 'user' : 'environment'} hidden onChange={(e) => escolher(e.target.files?.[0])} />
      <input ref={galeria} type="file" accept={tipo === 'FOTO' ? 'image/*' : 'image/*,application/pdf'} hidden onChange={(e) => escolher(e.target.files?.[0])} />
    </div>
  );
}

export function EtapaDocumentos() {
  const { data: p, isLoading } = usePainel();
  const nav = useNavigate();
  if (isLoading || !p) return <><Topo titulo="Documentos" voltar="/cadastro/moto" /><Carregando /></>;
  const bloqueado = !podeEditar(p.solicitacao.status);

  return (
    <div className="pb-6">
      <Topo titulo="Documentos" voltar="/cadastro/moto" />
      <Etapas atual={2} feitas={[p.progresso.dados, p.progresso.moto, p.progresso.documentos, false]} />
      <div className="flex flex-col gap-4 p-5">
        <p className="text-cinza">Fotos nítidas, em lugar claro e sem reflexo. A imagem é reduzida no seu celular para gastar menos internet.</p>
        {Object.keys(DOCS).map((t) => <CartaoDocumento key={t} tipo={t} doc={p.documentos[t]} bloqueado={bloqueado} />)}
        <button className="btn-primario" disabled={!p.progresso.documentos} onClick={() => nav('/cadastro/revisar')}>
          {p.progresso.documentos ? 'Continuar para revisão' : `Faltam ${p.progresso.documentosFaltando.length} documento(s)`}
        </button>
      </div>
    </div>
  );
}
