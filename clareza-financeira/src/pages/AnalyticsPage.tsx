import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useCategories, useTransactions } from '../lib/data';
import {
  CATEGORY_PALETTE,
  aggregateByCategory,
  bucketByMonth,
  lastNMonths,
  rangeForPeriod,
} from '../lib/analytics';
import type { MonthBucket } from '../lib/analytics';
import type { Category } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const fmt0 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const periods = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: '90d', label: '90 dias' },
  { id: '6m', label: '6 meses' },
  { id: 'this_year', label: 'Este ano' },
  { id: 'custom', label: 'Custom' },
];

export default function AnalyticsPage({ refreshKey = 0 }: Props) {
  const [periodId, setPeriodId] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rollUp, setRollUp] = useState(true);
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');

  const range = useMemo(() => {
    if (periodId === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return rangeForPeriod(periodId === 'custom' ? '30d' : periodId);
  }, [periodId, customFrom, customTo]);

  const txs = useTransactions({ from: range.from, to: range.to, limit: 600 });
  const cats = useCategories();
  // 6m always loaded for trend chart (independent of selected period)
  const trendRange = useMemo(() => rangeForPeriod('6m'), []);
  const trendTxs = useTransactions({ from: trendRange.from, to: trendRange.to, limit: 600 });

  useEffect(() => {
    if (!refreshKey) return;
    txs.refresh();
    trendTxs.refresh();
    cats.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of cats.data ?? []) m.set(c.id, c);
    return m;
  }, [cats.data]);

  const categoryAgg = useMemo(
    () => aggregateByCategory(txs.data ?? [], chartType, categoriesById, rollUp),
    [txs.data, chartType, categoriesById, rollUp]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let debt = 0;
    let invest = 0;
    let count = 0;
    for (const t of txs.data ?? []) {
      if (t.status === 'canceled' || t.status === 'planned') continue;
      const amt = Number(t.amount);
      count++;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
      else if (t.type === 'debt_payment') debt += amt;
      else if (t.type === 'investment') invest += amt;
    }
    return { income, expense, debt, invest, count, net: income - expense - debt - invest };
  }, [txs.data]);

  const monthBuckets = useMemo(
    () => bucketByMonth(trendTxs.data ?? [], lastNMonths(6)),
    [trendTxs.data]
  );

  const loading = txs.loading || cats.loading;

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="IV — Análise"
        title={
          <>
            Gráficos &<br />
            <em>panorama.</em>
          </>
        }
        note="Pizza, barras e linhas pra entender pra onde o dinheiro está indo. Filtre o período e veja o desenho dos gastos."
        badges={
          <button
            className="tb-pill"
            onClick={() => setRollUp((v) => !v)}
            title="Agrupar por categoria-pai"
          >
            <Ti name={rollUp ? 'binary-tree' : 'list'} />
            {rollUp ? 'Agrupado por pai' : 'Por subcategoria'}
          </button>
        }
      />

      {/* Period filters */}
      <article className="g" style={{ padding: '14px 18px' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="g-label" style={{ marginBottom: 0, marginRight: 6 }}>
            Período
          </span>
          <div
            className="inline-flex p-[3px] rounded-pill flex-wrap"
            style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
          >
            {periods.map((p) => {
              const active = periodId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriodId(p.id)}
                  className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                  style={
                    active
                      ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                      : { color: 'var(--text-3)' }
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {periodId === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="field-input"
                style={{ width: 140 }}
              />
              <span className="text-text-4 text-[11px]">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="field-input"
                style={{ width: 140 }}
              />
            </div>
          )}
          <span className="ml-auto text-[10px] text-text-4">
            {range.from} → {range.to} · {totals.count} lançamentos realizados
          </span>
        </div>
      </article>

      {/* KPIs */}
      <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi label="Receitas" value={totals.income} accent="#2ECC8A" loading={loading} />
        <Kpi label="Despesas" value={totals.expense} accent="#FF6B6B" loading={loading} negativeColor />
        <Kpi label="Dívidas pagas" value={totals.debt} accent="#FFA62B" loading={loading} negativeColor />
        <Kpi label="Investido" value={totals.invest} accent="#7C5BFF" loading={loading} />
      </section>

      {loading ? (
        <article className="g">
          <Skeleton height={300} />
        </article>
      ) : totals.count === 0 ? (
        <EmptyState
          icon="chart-pie"
          title="Sem dados nesse período"
          description="Tente ampliar o período ou cadastrar transações para ver gráficos aqui."
        />
      ) : (
        <>
          {/* Pie + Top categories side by side */}
          <section className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <article className="g" style={{ padding: '20px 22px' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="g-label" style={{ marginBottom: 4 }}>
                    Distribuição {chartType === 'expense' ? 'de despesas' : 'de receitas'}
                  </div>
                  <div className="text-[10.5px] text-text-3">
                    {categoryAgg.length} {categoryAgg.length === 1 ? 'categoria' : 'categorias'}
                  </div>
                </div>
                <div
                  className="inline-flex p-[3px] rounded-pill"
                  style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
                >
                  {(['expense', 'income'] as const).map((t) => {
                    const active = chartType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setChartType(t)}
                        className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                        style={
                          active
                            ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                            : { color: 'var(--text-3)' }
                        }
                      >
                        {t === 'expense' ? 'Despesas' : 'Receitas'}
                      </button>
                    );
                  })}
                </div>
              </div>
              {categoryAgg.length === 0 ? (
                <div className="text-[12px] text-text-3 mt-4">Nada nesse período.</div>
              ) : (
                <PieChart data={categoryAgg} />
              )}
            </article>

            <article className="g" style={{ padding: '20px 22px' }}>
              <div className="g-label" style={{ marginBottom: 14 }}>
                Top categorias do período
              </div>
              {categoryAgg.length === 0 ? (
                <div className="text-[12px] text-text-3">Nada nesse período.</div>
              ) : (
                <HorizontalBars data={categoryAgg.slice(0, 10)} />
              )}
            </article>
          </section>

          {/* Stacked monthly bars */}
          <article className="g" style={{ padding: '20px 22px' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="g-label" style={{ marginBottom: 4 }}>
                  Receita vs Despesa — últimos 6 meses
                </div>
                <div className="text-[10.5px] text-text-3">
                  Comparação mês a mês · linha = saldo líquido
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10.5px] text-text-3">
                <Legend dot="#2ECC8A" label="Receita" />
                <Legend dot="#FF6B6B" label="Despesa" />
                <Legend dot="#FFA62B" label="Dívidas" />
                <Legend dot="#7C5BFF" label="Invest." />
              </div>
            </div>
            <StackedBars buckets={monthBuckets} />
          </article>

          {/* Trend line - net result */}
          <article className="g" style={{ padding: '20px 22px' }}>
            <div className="g-label" style={{ marginBottom: 12 }}>
              Evolução do resultado líquido (6 meses)
            </div>
            <NetTrendChart buckets={monthBuckets} />
          </article>

          {/* Detail table */}
          <article className="g" style={{ padding: '14px 22px 18px' }}>
            <div className="g-label" style={{ marginBottom: 8 }}>
              Detalhe por categoria
            </div>
            <ul>
              {categoryAgg.map((c, i) => (
                <li
                  key={c.id}
                  className="grid items-center gap-3 py-2"
                  style={{
                    gridTemplateColumns: '24px 1fr 80px 100px 110px',
                    borderTop: i === 0 ? 'none' : '0.5px solid var(--border-lt)',
                  }}
                >
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ background: `${c.color}26` }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  </span>
                  <span className="text-[12.5px] text-text-1 truncate">{c.name}</span>
                  <span className="text-[11px] text-text-4 num-mono">{c.count} lan.</span>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--border-lt)' }}
                  >
                    <div
                      style={{
                        width: `${c.pct}%`,
                        height: '100%',
                        background: c.color,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] num-mono text-text-1">R$ {fmt2(c.total)}</div>
                    <div className="text-[10px] text-text-4">{c.pct.toFixed(1)}%</div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </>
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

interface KpiProps {
  label: string;
  value: number;
  accent: string;
  loading: boolean;
  negativeColor?: boolean;
}

function Kpi({ label, value, accent, loading, negativeColor }: KpiProps) {
  return (
    <article className="g relative overflow-hidden" style={{ padding: '18px 20px' }}>
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 2, background: accent, opacity: 0.85 }}
      />
      <div className="g-label">{label}</div>
      {loading ? (
        <Skeleton height={28} width="70%" />
      ) : (
        <div
          className="font-serif leading-none"
          style={{ fontSize: 26, color: negativeColor ? 'var(--red)' : 'var(--text-1)', letterSpacing: '-0.025em' }}
        >
          R$ {fmt0(value)}
        </div>
      )}
      <div className="text-[10px] text-text-4 mt-2">no período selecionado</div>
    </article>
  );
}

// ─── PIE CHART ──────────────────────────────────────────────────────────
interface PieData {
  id: string;
  name: string;
  color: string;
  total: number;
  pct: number;
}

function PieChart({ data }: { data: PieData[] }) {
  const top = data.slice(0, 8);
  const otherTotal = data.slice(8).reduce((s, c) => s + c.total, 0);
  const otherPct = data.slice(8).reduce((s, c) => s + c.pct, 0);
  const list =
    otherTotal > 0
      ? [...top, { id: '__other__', name: 'Outros', color: '#9CA3AF', total: otherTotal, pct: otherPct }]
      : top;

  const cx = 90;
  const cy = 90;
  const R = 80;
  let acc = -90;

  const arcs = list.map((c) => {
    const angle = (c.pct / 100) * 360;
    const start = acc;
    const end = acc + angle;
    acc = end;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = cx + R * Math.cos(startRad);
    const y1 = cy + R * Math.sin(startRad);
    const x2 = cx + R * Math.cos(endRad);
    const y2 = cy + R * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const path =
      angle >= 360
        ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} Z`
        : `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    return { ...c, path, midAngle: (start + end) / 2 };
  });

  const total = data.reduce((s, c) => s + c.total, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <defs>
            {arcs.map((a, i) => (
              <radialGradient key={i} id={`pie${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={a.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={a.color} stopOpacity="0.7" />
              </radialGradient>
            ))}
          </defs>
          {arcs.map((a, i) => (
            <path
              key={a.id}
              d={a.path}
              fill={`url(#pie${i})`}
              stroke="var(--card)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
      <div className="flex-1 min-w-0 space-y-2 max-h-[180px] overflow-y-auto">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-text-2 flex-1 min-w-0 truncate">{c.name}</span>
            <span className="text-text-3 num-mono">{c.pct.toFixed(1)}%</span>
            <span className="text-text-1 num-mono w-20 text-right">R$ {fmt0(c.total)}</span>
          </div>
        ))}
        <div
          className="text-[10px] text-text-4 pt-2 mt-1"
          style={{ borderTop: '0.5px solid var(--border-lt)' }}
        >
          Total · R$ {fmt2(total)}
        </div>
      </div>
    </div>
  );
}

// ─── HORIZONTAL BARS ────────────────────────────────────────────────────
function HorizontalBars({ data }: { data: PieData[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <ul className="space-y-3">
      {data.map((c) => {
        const w = (c.total / max) * 100;
        return (
          <li key={c.id} className="flex items-center gap-3 text-[11.5px]">
            <span className="text-text-2 w-32 truncate flex-shrink-0">{c.name}</span>
            <div className="flex-1 h-5 relative" style={{ background: 'var(--border-lt)', borderRadius: 5 }}>
              <div
                className="h-full flex items-center justify-end px-2"
                style={{
                  width: `${w}%`,
                  background: `linear-gradient(90deg, ${c.color}CC, ${c.color})`,
                  borderRadius: 5,
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  minWidth: 24,
                }}
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] num-mono text-text-1 font-medium"
              >
                R$ {fmt0(c.total)}
              </span>
            </div>
            <span className="text-text-3 num-mono w-12 text-right text-[10.5px]">
              {c.pct.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── STACKED BARS ───────────────────────────────────────────────────────
function StackedBars({ buckets }: { buckets: MonthBucket[] }) {
  if (buckets.length === 0) return null;
  const W = 720;
  const H = 220;
  const padX = 36;
  const padY = 22;
  const barW = (W - padX * 2) / buckets.length;
  const innerBarW = barW * 0.55;

  const maxIn = Math.max(...buckets.map((b) => b.income), 0);
  const maxOut = Math.max(...buckets.map((b) => b.expense + b.debt + b.invest), 0);
  const maxVal = Math.max(maxIn, maxOut, 1);
  const yScale = (H - padY * 2) / maxVal;
  const yFor = (v: number) => H - padY - v * yScale;

  // line for net
  const linePath = buckets
    .map((b, i) => {
      const x = padX + i * barW + barW / 2;
      const yMax = Math.max(maxIn, maxOut, 1);
      const yNet = H - padY - ((b.net + yMax) / (yMax * 2)) * (H - padY * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yNet.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="grdIncome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2ECC8A" stopOpacity="1" />
          <stop offset="100%" stopColor="#2ECC8A" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="grdExp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B6B" stopOpacity="1" />
          <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="grdDebt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFA62B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFA62B" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="grdInv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C5BFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7C5BFF" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* axis */}
      <line
        x1={padX}
        x2={W - padX}
        y1={H - padY}
        y2={H - padY}
        stroke="var(--border-lt)"
        strokeWidth="1"
      />

      {/* horizontal grid */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padX}
          x2={W - padX}
          y1={H - padY - (H - padY * 2) * p}
          y2={H - padY - (H - padY * 2) * p}
          stroke="var(--border-lt)"
          strokeDasharray="2 4"
          strokeWidth="0.5"
        />
      ))}

      {buckets.map((b, i) => {
        const cx = padX + i * barW + barW / 2;
        // income bar (left side)
        const ix = cx - innerBarW;
        const iyTop = yFor(b.income);
        const ih = H - padY - iyTop;
        // expense stack (right side)
        const ex = cx;
        const expH = b.expense * yScale;
        const debtH = b.debt * yScale;
        const invH = b.invest * yScale;

        let stackY = H - padY;
        return (
          <g key={i}>
            {/* income */}
            <rect
              x={ix}
              y={iyTop}
              width={innerBarW * 0.85}
              height={Math.max(0, ih)}
              fill="url(#grdIncome)"
              rx="3"
            />
            {/* expense */}
            <rect
              x={ex + 2}
              y={stackY - expH}
              width={innerBarW * 0.85}
              height={Math.max(0, expH)}
              fill="url(#grdExp)"
              rx="3"
            />
            {/* debt above expense */}
            <rect
              x={ex + 2}
              y={stackY - expH - debtH}
              width={innerBarW * 0.85}
              height={Math.max(0, debtH)}
              fill="url(#grdDebt)"
              rx="3"
            />
            {/* investment on top */}
            <rect
              x={ex + 2}
              y={stackY - expH - debtH - invH}
              width={innerBarW * 0.85}
              height={Math.max(0, invH)}
              fill="url(#grdInv)"
              rx="3"
            />
            {/* month label */}
            <text
              x={cx}
              y={H - 6}
              fontSize="10"
              textAnchor="middle"
              fill="#7A97B0"
              style={{ textTransform: 'lowercase' }}
            >
              {b.label}
            </text>
            {/* income label tiny */}
            {b.income > 0 && (
              <text
                x={ix + innerBarW * 0.42}
                y={iyTop - 4}
                fontSize="8.5"
                textAnchor="middle"
                fill="#2ECC8A"
                fontFamily="JetBrains Mono"
              >
                {fmt0(b.income)}
              </text>
            )}
            {b.expense + b.debt + b.invest > 0 && (
              <text
                x={ex + 2 + innerBarW * 0.42}
                y={stackY - expH - debtH - invH - 4}
                fontSize="8.5"
                textAnchor="middle"
                fill="#FF6B6B"
                fontFamily="JetBrains Mono"
              >
                {fmt0(b.expense + b.debt + b.invest)}
              </text>
            )}
          </g>
        );
      })}

      {/* net line (centered around midpoint) */}
      <path
        d={linePath}
        fill="none"
        stroke="#0C1B2C"
        strokeWidth="1.5"
        strokeOpacity="0.55"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── NET TREND LINE ─────────────────────────────────────────────────────
function NetTrendChart({ buckets }: { buckets: MonthBucket[] }) {
  if (buckets.length === 0) return null;
  const W = 720;
  const H = 160;
  const padX = 32;
  const padY = 18;

  const min = Math.min(...buckets.map((b) => b.net), 0);
  const max = Math.max(...buckets.map((b) => b.net), 0);
  const range = max - min || 1;
  const innerH = H - padY * 2;
  const stepX = buckets.length > 1 ? (W - padX * 2) / (buckets.length - 1) : 0;
  const yFor = (v: number) => padY + innerH - ((v - min) / range) * innerH;
  const xFor = (i: number) => padX + i * stepX;

  const linePath = buckets
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(b.net).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${xFor(buckets.length - 1).toFixed(1)},${yFor(0).toFixed(1)} L${xFor(0).toFixed(1)},${yFor(0).toFixed(1)} Z`;

  const lastNet = buckets[buckets.length - 1].net;
  const stroke = lastNet >= 0 ? '#0B6847' : '#B83A30';
  const fill = lastNet >= 0 ? '#2ECC8A' : '#FF6B6B';

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="grdNet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.32" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* zero line */}
      {min < 0 && (
        <line
          x1={padX}
          x2={W - padX}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke="var(--border)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
      )}

      <path d={areaPath} fill="url(#grdNet)" />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {buckets.map((b, i) => (
        <g key={i}>
          <circle
            cx={xFor(i)}
            cy={yFor(b.net)}
            r="4"
            fill={b.net >= 0 ? '#2ECC8A' : '#FF6B6B'}
            stroke="var(--card)"
            strokeWidth="2"
          />
          <text
            x={xFor(i)}
            y={H - 4}
            fontSize="10"
            textAnchor="middle"
            fill="#7A97B0"
            style={{ textTransform: 'lowercase' }}
          >
            {b.label}
          </text>
          <text
            x={xFor(i)}
            y={yFor(b.net) - 8}
            fontSize="9"
            textAnchor="middle"
            fontFamily="JetBrains Mono"
            fill={b.net >= 0 ? '#0B6847' : '#B83A30'}
          >
            {b.net >= 0 ? '+' : '−'}{fmt0(Math.abs(b.net))}
          </text>
        </g>
      ))}
    </svg>
  );
}

// keep palette referenced so tree-shaker doesn't drop it
void CATEGORY_PALETTE;
