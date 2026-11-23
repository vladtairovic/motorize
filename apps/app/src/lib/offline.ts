import Dexie, { type EntityTable } from 'dexie';

export interface CredencialCache {
  numero: string;
  status: string;
  validaAte: string;
  nome: string;
  placa: string | null;
  modelo?: string | null;
  cor?: string | null;
  foto: string | null;
  tipoAtividade?: string | null;
}

export interface ConsultaLocal {
  idLocal: string;
  numero: string | null;
  nome?: string | null;
  resultado: 'VALIDA' | 'VENCIDA' | 'SUSPENSA' | 'REVOGADA' | 'INVALIDA' | 'NAO_ENCONTRADA';
  realizadaEm: string;
  latitude?: number | null;
  longitude?: number | null;
  sincronizada: 0 | 1;
}

export interface Meta {
  chave: string;
  valor: any;
}

/** Banco local (IndexedDB): funciona sem sinal no campo. */
export const bd = new Dexie('motorize') as Dexie & {
  credenciais: EntityTable<CredencialCache, 'numero'>;
  consultas: EntityTable<ConsultaLocal, 'idLocal'>;
  meta: EntityTable<Meta, 'chave'>;
};

bd.version(1).stores({
  credenciais: 'numero, status',
  consultas: 'idLocal, sincronizada, realizadaEm',
  meta: 'chave',
});

export const meta = {
  async ler<T>(chave: string): Promise<T | undefined> {
    return (await bd.meta.get(chave))?.valor;
  },
  salvar(chave: string, valor: unknown) {
    return bd.meta.put({ chave, valor });
  },
};
