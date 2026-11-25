import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleMarker, MapContainer, TileLayer, Tooltip as MapTip } from 'react-leaflet';
import { api, baixar, sessao } from '../lib/api';
import { Cabecalho, Carregando, Erro } from '../components/ui';
import { ATIVIDADES, RESULTADO, dataHoraBR } from '../lib/util';

// Paleta validada (scripts/validate_palette.js): motor + âmbar; contraste baixo do âmbar é compensado por legenda, tooltip e tabela.
const S1 = '#0A0A0A';
const S2 = '#FFC800';
const EIXO = { fontSize: 12, fill: '#6A6A6A' };

interface Ind {
  resumo: Record<string, any>;
  porBairro: { bairro: string; cadastrados: number; credenciados: number }[];
  porAtividade: { atividade: string; total: number }[];
  plataformas: { plataforma: string; total: number }[];
  evolucao: { semana: string; enviadas: number; aprovadas: number }[];
  mapa: { lat: number; lng: number; total: number }[];
  consultas: { id: string; realizada_em: string; resultado: string; offline: boolean; agente: string; entregador: string | null; numero_credencial: string | null }[];
}

function Bloco({ titulo, sub, children, tabela }: { titulo: string; sub?: string; children: ReactNode; tabela?: ReactNode }) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <section className="painel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-cond text-xl font-bold text-ink">{titulo}</h2>
          {sub && <p className="text-sm text-cinza">{sub}</p>}
        </div>
        {tabela && (
          <button className="text-sm font-semibold text-motor hover:underline" onClick={() => setVerTabela(!verTabela)}>
            {verTabela ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        )}
      </div>
      {verTabela ? tabela : children}
    </section>
  );
}

function Indicador({ rotulo, valor, detalhe, to, alerta }: { rotulo: string; valor: ReactNode; detalhe?: string; to?: string; alerta?: boolean }) {
  const corpo = (
    <>
      <p className="text-sm text-cinza">{rotulo}</p>
      <p className={`font-cond text-[34px] font-bold leading-tight ${alerta ? 'text-alerta' : 'text-asfalto'}`}>{valor}</p>
      {detalhe && <p className="text-[13px] text-cinza">{detalhe}</p>}
    </>
  );
  return to ? <Link to={to} className="painel block p-4 hover:ring-motor/50">{corpo}</Link> : <div className="painel p-4">{corpo}</div>;
}

function TabelaSimples({ cols, linhas }: { cols: string[]; linhas: (string | number)[][] }) {
  return (
    <table className="tabela text-sm">
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function VisaoGeral() {
  const { data: d, isLoading, error } = useQuery({ queryKey: ['indicadores'], queryFn: () => api<Ind>('/admin/indicadores'), refetchInterval: 60_000 });
  const papel = sessao.ler()?.usuario.papel;

  async function exportar() {
    const blob = await baixar('/admin/relatorios/entregadores.csv');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `motorize-entregadores-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  }

  if (isLoading) return <Carregando />;
  if (error || !d) return <Erro>{(error as Error)?.message}</Erro>;
  const r = d.resumo;
  const pct = Math.min(100, r.adesao_pct);
  const fmt = (v: any, suf = '') => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}${suf}`);

  return (
    <>
      <Cabecalho
        titulo="Visão geral"
        sub="Indicadores do credenciamento em Toritama, atualizados a cada minuto."
        acoes={<button className="btn-secundario" onClick={exportar}>Exportar relatório (CSV)</button>}
      />

      {/* Indicador principal: adesão ao cadastro oficial */}
      <section className="escuro mb-5 rounded-xl p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-white/75">Motociclistas credenciados</p>
            <p className="font-cond text-6xl font-bold leading-none">
              {r.credenciados}<span className="text-3xl text-white/60"> de {r.meta}</span>
            </p>
          </div>
          <p className="max-w-xs text-right text-sm text-white/75">
            Meta: público estimado no desafio municipal. {r.contas} contas criadas, {r.enviadas} solicitações enviadas.
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Adesão">
          <div className="h-full rounded-full bg-refletivo" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-white/80">Adesão de {fmt(r.adesao_pct, '%')}</p>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Indicador rotulo="Aguardando análise" valor={r.fila} detalhe={`${r.em_analise} em análise agora`} to={papel !== 'GESTOR' ? '/solicitacoes' : undefined} alerta={r.fila > 10} />
        <Indicador rotulo="Com pendência" valor={r.pendencia} detalhe="Aguardando o entregador" />
        <Indicador rotulo="Tempo até decisão" valor={r.horas_ate_decisao ? `${fmt(r.horas_ate_decisao)} h` : '—'} detalhe="Média das aprovadas" />
        <Indicador rotulo="Retrabalho" valor={fmt(r.retrabalho_pct, '%')} detalhe="Devolvidas com pendência" />
        <Indicador rotulo="Conclusão do cadastro" valor={fmt(r.conclusao_pct, '%')} detalhe="Enviadas ÷ iniciadas" />
        <Indicador rotulo="Vencem em 30 dias" valor={r.vencendo_30d} detalhe={`${r.vencidas} já vencida(s)`} alerta={r.vencendo_30d > 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Bloco
          titulo="Solicitações por semana"
          sub="Últimas 12 semanas"
          tabela={<TabelaSimples cols={['Semana', 'Enviadas', 'Aprovadas']} linhas={d.evolucao.map((e) => [e.semana, e.enviadas, e.aprovadas])} />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.evolucao} barGap={2} margin={{ left: -18, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="#EFEFEF" />
              <XAxis dataKey="semana" tick={EIXO} tickLine={false} axisLine={{ stroke: '#E5E5E5' }} />
              <YAxis allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(10,10,10,.05)' }} contentStyle={{ borderRadius: 8, borderColor: '#E5E5E5' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="enviadas" name="Enviadas" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="aprovadas" name="Aprovadas" fill={S2} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Bloco>

        <Bloco titulo="Onde estão os entregadores" sub="Agrupado em áreas de ~250 m; áreas com menos de 3 pessoas ficam ocultas">
          <div className="h-[260px] overflow-hidden rounded-lg">
            <MapContainer center={[-8.0067, -36.0567]} zoom={14} scrollWheelZoom={false} className="size-full">
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {d.mapa.map((m, i) => (
                <CircleMarker key={i} center={[m.lat, m.lng]} radius={6 + Math.sqrt(m.total) * 4} pathOptions={{ color: '#fff', weight: 2, fillColor: '#E30613', fillOpacity: 0.75 }}>
                  <MapTip>{m.total} entregadores nesta área</MapTip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Bloco>

        <Bloco
          titulo="Por bairro"
          tabela={<TabelaSimples cols={['Bairro', 'Cadastrados', 'Credenciados']} linhas={d.porBairro.map((b) => [b.bairro, b.cadastrados, b.credenciados])} />}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, d.porBairro.length * 34)}>
            <BarChart data={d.porBairro} layout="vertical" barGap={2} margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#EFEFEF" />
              <XAxis type="number" allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="bairro" width={120} tick={EIXO} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(10,10,10,.05)' }} contentStyle={{ borderRadius: 8, borderColor: '#E5E5E5' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="cadastrados" name="Cadastrados" fill={S1} radius={[0, 4, 4, 0]} maxBarSize={12} />
              <Bar dataKey="credenciados" name="Credenciados" fill={S2} radius={[0, 4, 4, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </Bloco>

        <div className="grid gap-5">
          <Bloco titulo="Tipo de atividade">
            <ul className="space-y-2.5">
              {d.porAtividade.map((a) => {
                const max = Math.max(...d.porAtividade.map((x) => x.total));
                return (
                  <li key={a.atividade} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 text-sm">
                    <span>{ATIVIDADES[a.atividade] ?? a.atividade}</span>
                    <span className="h-2.5 rounded-r bg-motor" style={{ width: `${(a.total / max) * 100}%` }} />
                    <span className="text-right font-semibold">{a.total}</span>
                  </li>
                );
              })}
            </ul>
          </Bloco>
          <Bloco titulo="Fiscalização em campo" sub="Últimos 30 dias">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="font-cond text-3xl font-bold">{r.consultas_30d}</p><p className="text-[13px] text-cinza">consultas</p></div>
              <div><p className="font-cond text-3xl font-bold text-erro">{r.consultas_irregulares_30d}</p><p className="text-[13px] text-cinza">irregulares</p></div>
              <div><p className="font-cond text-3xl font-bold">{fmt(r.consultas_offline_pct, '%')}</p><p className="text-[13px] text-cinza">feitas sem sinal</p></div>
            </div>
          </Bloco>
        </div>
      </div>

      <section className="painel mt-5 overflow-x-auto">
        <h2 className="px-5 pt-5 font-cond text-xl font-bold text-ink">Últimas consultas de agentes</h2>
        <table className="tabela mt-3">
          <thead><tr><th>Quando</th><th>Entregador</th><th>Credencial</th><th>Resultado</th><th>Agente</th><th>Modo</th></tr></thead>
          <tbody>
            {d.consultas.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">{dataHoraBR(c.realizada_em)}</td>
                <td>{c.entregador ?? '—'}</td>
                <td>{c.numero_credencial ?? '—'}</td>
                <td><span className={c.resultado === 'VALIDA' ? 'font-semibold text-ok' : 'font-semibold text-erro'}>{RESULTADO[c.resultado]}</span></td>
                <td>{c.agente}</td>
                <td className="text-cinza">{c.offline ? 'Sem sinal' : 'Online'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
