/**
 * Dados de demonstração (todos FICTÍCIOS) para o MOTORIZE.
 * Rode com: npm run db:seed -w apps/api   (apaga e recria os dados)
 */
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { criarConexao } from './client';
import * as s from './schema';
import { assinarCredencial } from '../common/chaves';
import { mascararCpf, primeiroNome } from '../common/util';
import { StorageService } from '../common/storage.service';

const { db, sql } = criarConexao();
const storage = new StorageService();

// ───── utilidades ─────
let semente = 42;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const diasAtras = (d: number, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5);

function gerarCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  const dv = (arr: number[]) => {
    const soma = arr.reduce((acc, v, i) => acc + v * (arr.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join('');
}

function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, dados: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
    const td = Buffer.concat([Buffer.from(tipo), dados]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Avatar-silhueta ilustrativo (nenhuma foto real). */
function avatar(seed: number) {
  const fundos: [number, number, number][] = [[214, 222, 238], [226, 232, 220], [238, 228, 214], [222, 216, 236]];
  const peles: [number, number, number][] = [[141, 98, 72], [198, 150, 112], [110, 76, 56], [224, 182, 146], [168, 120, 88]];
  const bg = fundos[seed % fundos.length];
  const pele = peles[seed % peles.length];
  const camisa: [number, number, number] = [30 + (seed * 37) % 80, 42 + (seed * 53) % 60, 90 + (seed * 29) % 100];
  return png(240, 300, (x, y) => {
    const cab = (x - 120) ** 2 / 55 ** 2 + (y - 120) ** 2 / 66 ** 2 <= 1;
    const corpo = y > 205 && (x - 120) ** 2 / 115 ** 2 + (y - 320) ** 2 / 120 ** 2 <= 1;
    const pescoco = y > 170 && y < 215 && Math.abs(x - 120) < 22;
    if (cab || pescoco) return pele;
    if (corpo) return camisa;
    return bg;
  });
}

/** "Documento" ilustrativo: cartão com faixas, só para a demonstração. */
function docFake(cor: [number, number, number]) {
  return png(480, 300, (x, y) => {
    if (x < 8 || y < 8 || x > 471 || y > 291) return [180, 180, 180];
    if (y > 24 && y < 56) return cor;
    if (x > 32 && x < 140 && y > 80 && y < 220) return [205, 210, 218];
    if (x > 170 && x < 440 && [96, 130, 164, 198, 232].some((l) => y > l && y < l + 12)) return [120, 128, 140];
    return [246, 247, 249];
  });
}

const NOMES = ['José', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Luiz', 'Marcos', 'Gabriel', 'Rafael', 'Daniel', 'Marcelo', 'Bruno', 'Eduardo', 'Felipe', 'Raimundo', 'Rodrigo', 'Severino', 'Josivan', 'Edvaldo', 'Cícero', 'Damião', 'Erivaldo', 'Gilvan', 'Maria', 'Ana', 'Juliana', 'Patrícia', 'Aline', 'Jéssica', 'Rayane'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Alves', 'Barbosa', 'Cavalcanti', 'Araújo', 'Vieira', 'Nascimento', 'Gomes', 'Melo', 'Bezerra', 'Tavares', 'Siqueira', 'Freitas', 'Monteiro'];
// Bairros e pontos aproximados (ilustrativos) ao redor do centro de Toritama
const BAIRROS: [string, number, number][] = [
  ['Centro', -8.0067, -36.0567], ['Parque das Feiras', -8.0098, -36.0528], ['São José', -8.0031, -36.0611],
  ['Bela Vista', -8.0019, -36.0532], ['Santa Maria', -8.0118, -36.0603], ['Vila Nova', -8.0052, -36.0489],
  ['Torres', -8.0141, -36.0546], ['Alto do Cruzeiro', -7.9998, -36.0588],
];
const MOTOS: [string, string][] = [['Honda', 'CG 160 Fan'], ['Honda', 'CG 160 Start'], ['Honda', 'Biz 125'], ['Honda', 'Pop 110i'], ['Yamaha', 'Factor 150'], ['Yamaha', 'Fazer 250'], ['Honda', 'NXR 160 Bros'], ['Shineray', 'Jet 50'], ['Yamaha', 'YBR 150']];
const CORES = ['Vermelha', 'Preta', 'Branca', 'Prata', 'Azul', 'Cinza'];
const ATIV = ['APP_DELIVERY', 'APP_DELIVERY', 'APP_DELIVERY', 'MOTOFRETE', 'MOTOTAXI', 'AUTONOMO'] as const;
const PLAT = ['iFood', '99Food', 'Rappi', 'Keeta', 'Uber', 'Indrive', 'Comércio local'];
const L = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';

function placa() {
  return `${pick([...'KPQ'])}${L[Math.floor(rnd() * 25)]}${L[Math.floor(rnd() * 25)]}${Math.floor(rnd() * 10)}${L[Math.floor(rnd() * 10)]}${Math.floor(rnd() * 10)}${Math.floor(rnd() * 10)}`;
}

async function main() {
  console.log('Limpando dados…');
  await sql`TRUNCATE auditoria, sessoes, notificacoes, consultas, credenciais, documentos, solicitacao_eventos, solicitacoes, motocicletas, entregadores, servidores RESTART IDENTITY CASCADE`;
  await sql`ALTER SEQUENCE protocolo_seq RESTART WITH 1`;
  await sql`ALTER SEQUENCE credencial_seq RESTART WITH 1`;

  const senhaServidor = await hash('Motorize@2026');
  const senhaEntregador = await hash('123456');

  const servs = await db.insert(s.servidores).values([
    { nome: 'Administrador do Sistema', email: 'admin@motorize.local', papel: 'ADMIN', orgao: 'CTTU', matricula: '0001', senhaHash: senhaServidor },
    { nome: 'Eduardo Ramos', email: 'analista@motorize.local', papel: 'ANALISTA', orgao: 'CTTU', matricula: '1042', senhaHash: senhaServidor },
    { nome: 'Fabiana Torres', email: 'analista2@motorize.local', papel: 'ANALISTA', orgao: 'CTTU', matricula: '1057', senhaHash: senhaServidor },
    { nome: 'Agente Ronaldo Lins', email: 'agente@motorize.local', papel: 'AGENTE', orgao: 'CTTU', matricula: '2210', senhaHash: senhaServidor },
    { nome: 'Marta Albuquerque', email: 'gestor@motorize.local', papel: 'GESTOR', orgao: 'Secretaria de Transportes', matricula: '3005', senhaHash: senhaServidor },
  ]).returning();
  const analistas = [servs[1], servs[2]];
  const agente = servs[3];

  const fotoCache = new Map<number, { caminho: string; sha256: string; tamanho: number }>();
  const docsBase: Record<string, { caminho: string; sha256: string; tamanho: number }> = {};
  for (const [tipo, cor] of [['CNH', [30, 110, 70]], ['CRLV', [40, 70, 150]], ['COMPROVANTE_RESIDENCIA', [150, 110, 40]]] as const) {
    docsBase[tipo] = await storage.salvar(docFake(cor as unknown as [number, number, number]), 'demo', 'png');
  }

  // Distribuição de situações
  const plano: string[] = [
    ...Array(30).fill('APROVADA'), ...Array(2).fill('APROVADA_VENCENDO'), ...Array(2).fill('VENCIDA'), 'SUSPENSA',
    ...Array(8).fill('ENVIADA'), ...Array(3).fill('EM_ANALISE'), ...Array(5).fill('PENDENCIA'),
    ...Array(2).fill('REPROVADA'), ...Array(9).fill('RASCUNHO'),
  ];

  console.log(`Criando ${plano.length + 1} entregadores fictícios…`);
  let protocolo = 0;
  let credSeq = 0;
  const credsAtivas: { id: string; numero: string }[] = [];

  for (let i = 0; i <= plano.length; i++) {
    const demo = i === plano.length; // persona Jorlan (dossiê)
    const situacao = demo ? 'APROVADA' : plano[i];
    const nome = demo ? 'Jorlan Vieira da Silva' : `${pick(NOMES)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
    const [bairro, blat, blng] = demo ? BAIRROS[0] : pick(BAIRROS);
    const cpf = demo ? '52998224725' : gerarCpf();
    const criado = demo ? diasAtras(40) : diasAtras(5 + Math.floor(rnd() * 80));
    const ativ = demo ? 'MOTOTAXI' : pick(ATIV);
    const completo = situacao !== 'RASCUNHO' || rnd() > 0.5;
    const cnhValidade = new Date(Date.now() + (200 + rnd() * 1500) * 864e5).toISOString().slice(0, 10);

    const [e] = await db.insert(s.entregadores).values({
      cpf, nome, telefone: `819${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`, senhaHash: senhaEntregador,
      dataNascimento: completo ? `${1970 + Math.floor(rnd() * 32)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}` : null,
      bairro: completo ? bairro : null,
      logradouro: completo ? `Rua ${pick(SOBRENOMES)} ${pick(['Filho', 'Neto', ''])}`.trim() : null,
      numero: completo ? String(10 + Math.floor(rnd() * 900)) : null,
      localizacao: completo ? { x: blng + (rnd() - 0.5) * 0.006, y: blat + (rnd() - 0.5) * 0.006 } : null,
      tipoAtividade: completo ? ativ : null,
      plataformas: completo && ativ === 'APP_DELIVERY' ? [...new Set([pick(PLAT), pick(PLAT)])] : ativ === 'MOTOTAXI' ? ['Indrive'] : [],
      cnhNumero: completo ? String(Math.floor(1e10 + rnd() * 8.9e10)) : null,
      cnhCategoria: completo ? pick(['A', 'A', 'AB', 'AB', 'AC']) : null,
      cnhValidade: completo ? cnhValidade : null,
      consentimentoEm: criado, consentimentoVersao: '1.0', criadoEm: criado, atualizadoEm: criado,
    }).returning();

    if (completo) {
      const [marca, modelo] = pick(MOTOS);
      await db.insert(s.motocicletas).values({
        entregadorId: e.id, placa: demo ? 'PEX1T26' : placa(), renavam: String(Math.floor(1e10 + rnd() * 8.9e10)),
        marca, modelo, ano: 2008 + Math.floor(rnd() * 17), cor: pick(CORES),
      }).onConflictDoNothing();
    }

    const enviada = new Date(+criado + (1 + rnd() * 3) * 864e5);
    const statusSol = situacao.startsWith('APROVADA') || ['VENCIDA', 'SUSPENSA'].includes(situacao) ? 'APROVADA' : situacao;
    const decidida = statusSol === 'APROVADA' || statusSol === 'REPROVADA' ? new Date(+enviada + (4 + rnd() * 60) * 36e5) : null;
    const analista = pick(analistas);
    const teveP = statusSol === 'APROVADA' && rnd() < 0.2;

    const [sol] = await db.insert(s.solicitacoes).values({
      entregadorId: e.id, protocolo: `MTZ-2026-${String(++protocolo).padStart(6, '0')}`, status: statusSol as any,
      enviadaEm: statusSol === 'RASCUNHO' ? null : enviada,
      analiseIniciadaEm: ['EM_ANALISE', 'APROVADA', 'REPROVADA', 'PENDENCIA'].includes(statusSol) ? new Date(+enviada + 36e5) : null,
      decididaEm: decidida,
      analistaId: ['EM_ANALISE', 'APROVADA', 'REPROVADA', 'PENDENCIA'].includes(statusSol) ? analista.id : null,
      motivo: statusSol === 'PENDENCIA' ? 'Comprovante de residência: imagem ilegível, envie uma foto com boa iluminação.'
        : statusSol === 'REPROVADA' ? 'CNH sem categoria A. É necessário habilitação para motocicleta.' : null,
      qtdPendencias: statusSol === 'PENDENCIA' || teveP ? 1 : 0,
      criadoEm: criado, atualizadoEm: decidida ?? enviada,
    }).returning();

    const eventos: (typeof s.solicitacaoEventos.$inferInsert)[] = [
      { solicitacaoId: sol.id, status: 'RASCUNHO', atorTipo: 'ENTREGADOR', atorId: e.id, mensagem: 'Cadastro iniciado', criadoEm: criado },
    ];
    if (statusSol !== 'RASCUNHO') eventos.push({ solicitacaoId: sol.id, status: 'ENVIADA', atorTipo: 'ENTREGADOR', atorId: e.id, mensagem: 'Solicitação enviada para análise', criadoEm: enviada });
    if (sol.analiseIniciadaEm) eventos.push({ solicitacaoId: sol.id, status: 'EM_ANALISE', atorTipo: 'SERVIDOR', atorId: analista.id, mensagem: 'Análise iniciada pela CTTU', criadoEm: sol.analiseIniciadaEm });
    if (statusSol === 'PENDENCIA') eventos.push({ solicitacaoId: sol.id, status: 'PENDENCIA', atorTipo: 'SERVIDOR', atorId: analista.id, mensagem: sol.motivo, criadoEm: new Date(+enviada + 5 * 36e5) });
    if (decidida) eventos.push({ solicitacaoId: sol.id, status: statusSol as any, atorTipo: 'SERVIDOR', atorId: analista.id, mensagem: statusSol === 'APROVADA' ? 'Cadastro aprovado. Credencial emitida.' : sol.motivo, criadoEm: decidida });
    await db.insert(s.solicitacaoEventos).values(eventos);

    // Documentos
    if (completo) {
      const seedFoto = i % 7;
      if (!fotoCache.has(seedFoto)) fotoCache.set(seedFoto, await storage.salvar(avatar(seedFoto + 1), 'demo', 'png'));
      const tipos = ['CNH', 'CRLV', 'COMPROVANTE_RESIDENCIA', 'FOTO'] as const;
      await db.insert(s.documentos).values(
        tipos
          .filter(() => statusSol !== 'RASCUNHO' || rnd() > 0.4)
          .map((tipo) => {
            const arq = tipo === 'FOTO' ? fotoCache.get(seedFoto)! : docsBase[tipo];
            const status =
              statusSol === 'APROVADA' ? 'ACEITO'
              : statusSol === 'PENDENCIA' ? (tipo === 'COMPROVANTE_RESIDENCIA' ? 'RECUSADO' : 'ACEITO')
              : statusSol === 'REPROVADA' ? (tipo === 'CNH' ? 'RECUSADO' : 'ACEITO')
              : 'ENVIADO';
            return {
              entregadorId: e.id, solicitacaoId: sol.id, tipo, mime: 'image/png', ...arq, status: status as any,
              motivoRecusa: status === 'RECUSADO' ? (tipo === 'CNH' ? 'Categoria não habilita motocicleta' : 'Imagem ilegível') : null,
              criadoEm: enviada,
            };
          }),
      );
    }

    // Credencial
    if (statusSol === 'APROVADA' && decidida) {
      const numero = `TOR-${String(++credSeq).padStart(5, '0')}`;
      let validaAte = new Date(+decidida + 365 * 864e5);
      let status: 'ATIVA' | 'VENCIDA' | 'SUSPENSA' = 'ATIVA';
      let emitida = decidida;
      if (situacao === 'APROVADA_VENCENDO') { emitida = diasAtras(345); validaAte = new Date(Date.now() + (10 + rnd() * 15) * 864e5); }
      if (situacao === 'VENCIDA') { emitida = diasAtras(380); validaAte = diasAtras(15); status = 'VENCIDA'; }
      if (situacao === 'SUSPENSA') status = 'SUSPENSA';
      const moto = await db.query.motocicletas.findFirst({ where: (m, { eq }) => eq(m.entregadorId, e.id) });
      const token = assinarCredencial({
        n: numero, nm: primeiroNome(nome), cpf: mascararCpf(cpf), pl: moto?.placa ?? '', at: ativ,
        em: Math.floor(+emitida / 1000), ex: Math.floor(+validaAte / 1000),
      });
      const [c] = await db.insert(s.credenciais).values({
        numero, entregadorId: e.id, solicitacaoId: sol.id, status, emitidaEm: emitida, validaAte, token,
        motivoStatus: status === 'SUSPENSA' ? 'Suspensa por irregularidade no licenciamento da moto (CRLV vencido).' : null,
      }).returning();
      if (status === 'ATIVA') credsAtivas.push({ id: c.id, numero });
      await db.insert(s.notificacoes).values({
        entregadorId: e.id, titulo: 'Cadastro aprovado', mensagem: `Sua credencial ${numero} já está disponível no app.`,
        tipo: 'APROVACAO', criadoEm: decidida, lidaEm: demo ? null : decidida,
      });
    }
    if (statusSol === 'PENDENCIA')
      await db.insert(s.notificacoes).values({ entregadorId: e.id, titulo: 'Seu cadastro tem pendências', mensagem: sol.motivo!, tipo: 'PENDENCIA' });
  }

  await sql`SELECT setval('protocolo_seq', ${protocolo})`;
  await sql`SELECT setval('credencial_seq', ${credSeq})`;

  // Consultas em campo (últimos 30 dias)
  const consultas = Array.from({ length: 90 }, (_, k) => {
    const c = pick(credsAtivas);
    const resultado = rnd() < 0.86 ? 'VALIDA' : pick(['VENCIDA', 'INVALIDA', 'SUSPENSA'] as const);
    const [, lat, lng] = pick(BAIRROS);
    return {
      idLocal: `seed-${k}`, credencialId: resultado === 'INVALIDA' ? null : c.id, numeroCredencial: resultado === 'INVALIDA' ? null : c.numero,
      agenteId: agente.id, resultado: resultado as any, offline: rnd() < 0.35,
      localizacao: { x: lng + (rnd() - 0.5) * 0.004, y: lat + (rnd() - 0.5) * 0.004 }, realizadaEm: diasAtras(rnd() * 30, rnd() * 10),
    };
  });
  await db.insert(s.consultas).values(consultas);

  await db.insert(s.notificacoes).values({
    entregadorId: null, titulo: 'Bem-vindo ao MOTORIZE', mensagem: 'Cadastro oficial dos motociclistas de entrega de Toritama.', tipo: 'COMUNICADO',
  });

  console.log('✔ Seed concluído\n');
  console.log('  Painel municipal (http://localhost:5174) — senha: Motorize@2026');
  console.log('    admin@motorize.local · analista@motorize.local · gestor@motorize.local');
  console.log('  App do entregador (http://localhost:5173)');
  console.log('    Entregador demo: CPF 529.982.247-25 / senha 123456');
  console.log('    Agente de campo: agente@motorize.local / Motorize@2026');
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
