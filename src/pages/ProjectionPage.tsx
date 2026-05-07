import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import {
  accountBalanceFromTx,
  applyTxToBalance,
  expandRecurring,
  useAccounts,
  useRecurring,
  useTransactions,
} from '../lib/data';
import type { RecurringTransaction, Transaction } from '../lib/types';

interface Props {
  refreshKey?: number;
  onNavigate: (page: string) => void;
}

const fmt = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const monthShort = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface ProjectedTx {
  date: string;
  description: string;
  amount: number;
  type: Transaction['type'];
  source: 'planned' | 'recurring';
}

interface MonthBucket {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  startBalance: number;
  endBalance: number;
}

export default function ProjectionPage({ refreshKey = 0, onNavigate }: Props) {
  const [horizonMonths, setHorizonMonths] = useState(6);
  const accounts = useAccounts();
  const recurring = useRecurring({ activeOnly: true });
  const allTxs = useTransactions({ limit: 600, excludeStatus: 'canceled' });

  useEffect(() => {
    if (!refreshKey) return;
    accounts.refresh();
    recurring.refresh();
    allTxs.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const loading = accounts.loading || recurring.loading || allTxs.loading;

  const today = useMemo(() => todayDate(), []);
  const horizon = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + horizonMonths);
    d.setDate(0);
    return d;
  }, [today, horizonMonths]);
  const todayISO = toISO(today);

  const currentBalance = useMemo(() => {
    if (!accounts.data || !allTxs.data) return 0;
    return accounts.data.filter((a) => a.is_active).reduce((sum, a) => sum + accountBalanceFromTx(a, allTxs.data ?? []), 0);
  }, [accounts.data, allTxs.data]);

  // Build the full projected timeline: planned transactions + materialized "virtual" recurrences
  const timeline = useMemo<ProjectedTx[]>(() => {
    const out: ProjectedTx[] = [];

    // 1) planned transactions in the horizon
    for (const t of allTxs.data ?? []) {
      if (t.status !== 'planned') continue;
      if (t.transaction_date < todayISO) continue;
      if (t.transaction_date > toISO(horizon)) continue;
      out.push({
        date: t.transaction_date,
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        source: 'planned',
      });
    }

    // 2) recurring rules — fill gaps where no transaction was materialized yet
    const plannedKeys = new Set(
      (allTxs.data ?? [])
        .filter((t) => t.recurring_id && t.status === 'planned')
        .map((t) => `${t.recurring_id}|${t.transaction_date}`)
    );

    for (const rec of recurring.data ?? []) {
      if (!rec.is_active) continue;
      const dates = expandRecurring(rec as RecurringTransaction, today, horizon);
      for (const d of dates) {
        if (plannedKeys.has(`${rec.id}|${d}`)) continue; // already accounted as planned
        out.push({
          date: d,
          description: rec.description,
          amount: Number(rec.amount),
          type: rec.type,
          source: 'recurring',
        });
      }
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [allTxs.data, recurring.data, today, horizon, todayISO]);

  const monthBuckets = useMemo<MonthBucket[]>(() => {
    const buckets = new Map<string, MonthBucket>();
    const d = new Date(today);
    for (let i = 0; i < horizonMonths; i++) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      buckets.set(key, { year: y, month: m, income: 0, expense: 0, net: 0, startBalance: 0, endBalance: 0 });
      d.setMonth(d.getMonth() + 1);
    }

    for (const t of timeline) {
      const [y, m] = t.date.split('-').map(Number);
      const key = `${y}-${m}`;
      const b = buckets.get(key);
      if (!b) continue;
      if (t.type === 'income') b.income += t.amount;
      else b.expense += t.amount;
    }

    let running = currentBalance;
    const arr = Array.from(buckets.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
    for (const b of arr) {
      b.startBalance = running;
      b.net = b.income - b.expense;
      running += b.net;
      b.endBalance = running;
    }
    return arr;
  }, [timeline, currentBalance, today, horizonMonths]);

  const minEnd = monthBuckets.length ? Math.min(...monthBuckets.map((b) => b.endBalance)) : currentBalance;
  const finalEnd = monthBuckets.length ? monthBuckets[monthBuckets.length - 1].endBalance : currentBalance;

  // build per-day balance points for the chart
  const chartPoints = useMemo<Array<{ date: Date; balance: number }>>(() => {
    if (loading) return [];
    const days: Array<{ date: Date; balance: number }> = [];
    let bal = currentBalance;
    const d = new Date(today);
    const endDate = new Date(horizon);
    let txi = 0;
    while (d <= endDate) {
      const iso = toISO(d);
      while (txi < timeline.length && timeline[txi].date === iso) {
        const fakeTx: Transaction = {
          id: '',
          user_id: '',
          account_id: null,
          category_id: null,
          import_batch_id: null,
          recurring_id: null,
          description: timeline[txi].description,
          amount: timeline[txi].amount,
          type: timeline[txi].type,
          transaction_date: iso,
          payment_method: null,
          status: 'planned',
          source: 'manual',
          notes: null,
          created_at: '',
          updated_at: '',
        };
        bal = applyTxToBalance(bal, fakeTx);
        txi++;
      }
      days.push({ date: new Date(d), balance: bal });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [timeline, currentBalance, today, horizon, loading]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, ProjectedTx[]>();
    for (const t of timeline) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries()).slice(0, 30);
  }, [timeline]);

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="I — Visão"
        title={
          loading ? (
            <>
              Projeção financeira.<br />
              <em>Carregando...</em>
            </>
          ) : (
            <>
              Próximos {horizonMonths} meses.<br />
              <em>
                Saldo projetado{' '}
                <span style={{ color: finalEnd < 0 ? 'var(--red)' : 'var(--green)' }}>
                  {finalEnd < 0 ? '−R$ ' : 'R$ '}
                  {fmt(Math.abs(finalEnd), 0)}
                </span>
                .
              </em>
            </>
          )
        }
        note={
          <>
            saldo atual <strong>R$ {fmt(currentBalance, 0)}</strong> · mínimo previsto{' '}
            <strong className={minEnd < 0 ? 'text-red' : ''}>
              {minEnd < 0 ? '−R$ ' : 'R$ '}
              {fmt(Math.abs(minEnd), 0)}
            </strong>
          </>
        }
        badges={
          <div
            className="inline-flex p-[3px] rounded-pill"
            style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
          >
            {[3, 6, 12].map((m) => {
              const active = horizonMonths === m;
              return (
                <button
                  key={m}
                  onClick={() => setHorizonMonths(m)}
                  className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                  style={
                    active
                      ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                      : { color: 'var(--text-3)' }
                  }
                >
                  {m}m
                </button>
              );
            })}
          </div>
        }
      />

      {loading ? (
        <article className="g" style={{ padding: 18 }}>
          <Skeleton height={200} />
        </article>
      ) : monthBuckets.length === 0 || (timeline.length === 0 && (recurring.data?.length ?? 0) === 0) ? (
        <EmptyState
          icon="chart-line"
          title="Nada para projetar ainda"
          description="Cadastre suas despesas fixas (aluguel, contas, salário) ou crie lançamentos com data futura. A projeção vai usar isso para estimar seu saldo."
          cta={{ label: 'Cadastrar despesa fixa', onClick: () => onNavigate('recurring') }}
        />
      ) : (
        <>
          {minEnd < 0 && (
            <article className="g" style={{ padding: '14px 18px', borderLeft: '2px solid var(--red)' }}>
              <div className="flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--red-lt)', color: 'var(--red)' }}
                >
                  <Ti name="alert-triangle" size={15} />
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-text-1">
                    Atenção: seu saldo projetado fica negativo
                  </div>
                  <div className="text-[11.5px] text-text-3 mt-0.5">
                    Considerando despesas fixas e lançamentos planejados, você chega a{' '}
                    <strong className="text-red">−R$ {fmt(Math.abs(minEnd), 0)}</strong> no menor ponto. Hora de
                    revisar o planejamento.
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* CHART */}
          <article className="g" style={{ padding: '20px 22px' }}>
            <div className="g-label">Saldo projetado dia a dia</div>
            <BalanceChart points={chartPoints} buckets={monthBuckets} />
          </article>

          {/* MONTHS */}
          <section
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(monthBuckets.length, 3)}, 1fr)` }}
          >
            {monthBuckets.slice(0, 6).map((b) => (
              <article key={`${b.year}-${b.month}`} className="g" style={{ padding: '16px 18px' }}>
                <div className="g-label" style={{ marginBottom: 6 }}>
                  {monthShort(b.year, b.month)} {b.year}
                </div>
                <div className={`g-val md ${b.endBalance < 0 ? 'neg' : ''}`}>
                  {b.endBalance < 0 ? '−R$ ' : 'R$ '}
                  {fmt(Math.abs(b.endBalance), 0)}
                </div>
                <div className="g-sub" style={{ marginTop: 2 }}>
                  saldo final
                </div>
                <div
                  className="mt-3 grid gap-1 text-[11px]"
                  style={{ gridTemplateColumns: '1fr 1fr', color: 'var(--text-3)' }}
                >
                  <div>
                    Entradas <strong className="text-green num-mono">+{fmt(b.income, 0)}</strong>
                  </div>
                  <div className="text-right">
                    Saídas <strong className="text-red num-mono">−{fmt(b.expense, 0)}</strong>
                  </div>
                </div>
                <div
                  className="mt-2 text-[11px] num-mono"
                  style={{ color: b.net < 0 ? 'var(--red)' : 'var(--green)' }}
                >
                  Resultado {b.net < 0 ? '−' : '+'} {fmt(Math.abs(b.net), 0)}
                </div>
              </article>
            ))}
          </section>

          {/* UPCOMING TIMELINE */}
          <article className="g" style={{ padding: '14px 20px 16px' }}>
            <div className="g-label" style={{ marginBottom: 8 }}>
              Próximos lançamentos
            </div>
            {groupedByDay.length === 0 ? (
              <div className="text-[12px] text-text-3">Sem lançamentos previstos no horizonte selecionado.</div>
            ) : (
              <ul>
                {groupedByDay.map(([date, items]) => {
                  const [y, m, d] = date.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const dateLabel = dateObj.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  }).replace(/\.$/g, '');
                  const dayIn = items.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0);
                  const dayOut = items.filter((i) => i.type !== 'income').reduce((s, i) => s + i.amount, 0);
                  const dayNet = dayIn - dayOut;
                  return (
                    <li key={date} style={{ borderTop: '0.5px solid var(--border-lt)', padding: '10px 0' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[11.5px] text-text-3 capitalize">{dateLabel}</div>
                        <div
                          className={`num-mono text-[11.5px] ${dayNet >= 0 ? 'text-green' : 'text-red'}`}
                        >
                          {dayNet >= 0 ? '+' : '−'} R$ {fmt(Math.abs(dayNet), 0)}
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {items.map((it, i) => {
                          const positive = it.type === 'income';
                          return (
                            <li
                              key={i}
                              className="grid items-center gap-3 text-[12px]"
                              style={{ gridTemplateColumns: '1fr auto auto' }}
                            >
                              <span className="text-text-2 truncate">{it.description}</span>
                              <span
                                className="text-[10px] uppercase"
                                style={{
                                  letterSpacing: '0.08em',
                                  color: it.source === 'recurring' ? 'var(--text-4)' : 'var(--text-3)',
                                }}
                              >
                                {it.source === 'recurring' ? 'fixa' : 'planejado'}
                              </span>
                              <span className={`num-mono ${positive ? 'text-green' : 'text-red'}`}>
                                {positive ? '+' : '−'} {fmt(Math.abs(it.amount), 2)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </>
      )}
    </div>
  );
}

interface ChartProps {
  points: Array<{ date: Date; balance: number }>;
  buckets: MonthBucket[];
}

function BalanceChart({ points, buckets }: ChartProps) {
  if (points.length === 0) return null;
  const W = 800;
  const H = 180;
  const padX = 30;
  const padY = 18;
  const min = Math.min(...points.map((p) => p.balance), 0);
  const max = Math.max(...points.map((p) => p.balance), 0);
  const range = max - min || 1;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const yFor = (v: number) => padY + innerH - ((v - min) / range) * innerH;
  const xFor = (i: number) => padX + i * stepX;
  const zeroY = yFor(0);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.balance).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${xFor(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  // month dividers
  const monthLines = buckets.map((b) => {
    const dateAtStart = new Date(b.year, b.month - 1, 1);
    const idx = points.findIndex((p) => p.date >= dateAtStart);
    return { idx: idx < 0 ? 0 : idx, label: monthShort(b.year, b.month) };
  });

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
      <defs>
        <linearGradient id="grdProj" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B6847" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0B6847" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zero line */}
      {min < 0 && (
        <line
          x1={padX}
          x2={W - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="#E0EBF5"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      {/* month dividers */}
      {monthLines.map((ml, i) => (
        <g key={i}>
          <line
            x1={xFor(ml.idx)}
            x2={xFor(ml.idx)}
            y1={padY}
            y2={H - padY}
            stroke="#E0EBF5"
            strokeWidth="0.5"
          />
          <text
            x={xFor(ml.idx) + 4}
            y={H - 4}
            fontSize="9"
            fill="#7A97B0"
            style={{ textTransform: 'lowercase' }}
          >
            {ml.label}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#grdProj)" />
      <path
        d={linePath}
        fill="none"
        stroke="#0B6847"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* current point */}
      <circle cx={xFor(0)} cy={yFor(points[0].balance)} r="3.5" fill="#0B6847" />
      <circle cx={xFor(points.length - 1)} cy={yFor(points[points.length - 1].balance)} r="3.5" fill="#0B6847" />
    </svg>
  );
}
