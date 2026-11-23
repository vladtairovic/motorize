import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

/** Leitor de QR pela câmera traseira, com alternativas: imagem salva ou código colado. */
export function LeitorQr({ onLer }: { onLer: (texto: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [erroCamera, setErroCamera] = useState('');
  const [manual, setManual] = useState(false);
  const [texto, setTexto] = useState('');
  const lido = useRef(false);

  useEffect(() => {
    if (!video.current) return;
    lido.current = false;
    const sc = new QrScanner(
      video.current,
      (r) => {
        if (lido.current) return;
        lido.current = true;
        navigator.vibrate?.(80);
        onLer(r.data);
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8, returnDetailedScanResult: true },
    );
    sc.start().catch(() =>
      setErroCamera(window.isSecureContext ? 'Não foi possível abrir a câmera. Verifique a permissão do navegador.' : 'A câmera só funciona em endereço seguro (https ou localhost).'),
    );
    return () => { sc.stop(); sc.destroy(); };
  }, [onLer]);

  async function deImagem(f?: File) {
    if (!f) return;
    try {
      const r = await QrScanner.scanImage(f, { returnDetailedScanResult: true });
      onLer(r.data);
    } catch {
      setErroCamera('Nenhum QR Code encontrado nessa imagem.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-asfalto">
        <video ref={video} className="size-full object-cover" muted playsInline />
        {erroCamera && <p className="absolute inset-x-0 bottom-0 bg-asfalto/90 p-3 text-center text-[15px] text-white">{erroCamera}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secundario" onClick={() => arquivo.current?.click()}>Ler de uma imagem</button>
        <button type="button" className="btn-secundario" onClick={() => setManual(!manual)}>Colar código</button>
      </div>
      <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => deImagem(e.target.files?.[0])} />
      {manual && (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) onLer(texto.trim()); }}>
          <textarea className="entrada min-h-24 py-3 font-mono text-sm" placeholder="MTZ1.…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn-primario">Conferir código</button>
        </form>
      )}
    </div>
  );
}
