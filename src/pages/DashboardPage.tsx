import React, { useEffect, useMemo } from 'react';
import Ti from '../components/Ti';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import {
  currentMonth,
  monthRange,
  sumByCategory,
  useDebts,
  useGoals,
  useInsights,
  useMonthlyStatement,
  useMonthTransactions,
  useTransactions,
} from '../lib/data';
import { useDashboardWidgets } from '../lib/preferences';
import type { Transaction } from '../lib/types';

interface Props {
  userName: string;
  onNewTransaction: () => void;
  onNavigate: (page: string) => void;
  refreshKey?: number;
}

const fmt = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const monthLabelPt = (year: number, month: number) => {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
};

function previousMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

const CATEGORY_PALETTE = [
  '#FF4F8B', // rosa
  '#7C5BFF', // roxo
  '#FFA62B', // laranja
  '#2ECC8A', // verde
  '#4A7CFF', // azul
  '#FF6B6B', // coral
  '#22D3EE', // ciano
  '#A855F7', // violeta
  '#F59E0B', // âmbar
  '#10B981', // esmeralda
];

function colorForIndex(i: number, fallback?: string | null) {
  if (fallback) return fallback;
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
}

function pickIconFor(t: Transaction): { name: string; tone: 'in' | 'out' | 'neutral' } {
  if (t.type === 'income') return { name: 'arrow-down-right', tone: 'in' };
  if (t.type === 'investment') return { name: 'trending-up', tone: 'in' };
  if (t.type === 'transfer') return { name: 'transfer', tone: 'neutral' };
  if (t.category?.icon) return { name: t.category.icon, tone: 'out' };
  return { name: 'arrow-up-right', tone: 'out' };
}

export default function DashboardPage({ userName, onNewTransaction, onNavigate, refreshKey = 0 }: Props) {
  const { year, month } = currentMonth();
  const prev = previousMonth(year, month);
  const [widgets] = useDashboardWidgets();

  const stmt = useMonthlyStatement(year, month);
  const stmtPrev = useMonthlyStatement(prev.year, prev.month);
  const monthTx = useMonthTransactions(year, month);
  const recent = useTransactions({ limit: 5 });
  const debts = useDebts();
  const goals = useGoals();
  const insights = useInsights();

  // refetch on save
  useEffect(() => {
    if (!refreshKey) return;
    stmt.refresh();
    monthTx.refresh();
    recent.refresh();
    debts.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const first = userName.charAt(0).toUpperCase() + userName.slice(1);
  const totalIncome = stmt.data?.total_income ?? 0;
  const totalExpenses = stmt.data?.total_expenses ?? 0;
  const netResult = stmt.data?.net_result ?? 0;
  const prevResult = stmtPrev.data?.net_result ?? 0;
  const deltaPct = prevResult ? Math.round(((netResult - prevResult) / Math.abs(prevResult)) * 100) : null;

  const totalDebt = useMemo(
    () => debts.data?.filter((d) => d.status === 'open' || d.status === 'overdue' || d.status === 'renegotiated').reduce((s, d) => s + Number(d.current_amount), 0) ?? 0,
    [debts.data]
  );
  const topDebts = useMemo(
    () =>
      (debts.data ?? [])
        .filter((d) => d.status !== 'paid' && d.status !== 'defaulted')
        .sort((a, b) => Number(b.current_amount) - Number(a.current_amount))
        .slice(0, 2),
    [debts.data]
  );

  const reserveGoal = useMemo(
    () => (goals.data ?? []).find((g) => g.type === 'emergency_fund') ?? null,
    [goals.data]
  );
  const reservePct = reserveGoal && Number(reserveGoal.target_amount) > 0
    ? Math.round((Number(reserveGoal.current_amount) / Number(reserveGoal.target_amount)) * 100)
    : null;

  const alertsCount = (insights.data ?? []).filter((i) => !i.is_read && (i.severity === 'warning' || i.severity === 'danger')).length;

  // Category breakdown for current month
  const catMap = useMemo(() => sumByCategory(monthTx.data ?? []), [monthTx.data]);

  // Top categories with vibrant colors
  const catList = useMemo(() => {
    const all = Array.from(catMap.entries())
      .map(([id, c]) => ({ id, name: c.name, total: c.total, color: c.color }))
      .sort((a, b) => b.total - a.total);
    const total = all.reduce((s, c) => s + c.total, 0);
    return all.map((c, i) => ({
      ...c,
      color: colorForIndex(i, c.color),
      pct: total ? (c.total / total) * 100 : 0,
    }));
  }, [catMap]);

  const catTotal = useMemo(() => catList.reduce((s, c) => s + c.total, 0), [catList]);

  // Doughnut math (top 5 + outros)
  const donutSegs = useMemo(() => {
    if (!catTotal) return [];
    const top = catList.slice(0, 5);
    const restTotal = catList.slice(5).reduce((s, c) => s + c.total, 0);
    const list = top.map((c) => ({ name: c.name, total: c.total, color: c.color }));
    if (restTotal > 0) list.push({ name: 'Outros', total: restTotal, color: '#CBD8E5' });
    const R = 38;
    const C = 2 * Math.PI * R;
    let offset = 0;
    return list.map((s) => {
      const len = (s.total / catTotal) * C;
      const seg = { ...s, len, offset, pct: Math.round((s.total / catTotal) * 100) };
      offset -= len;
      return seg;
    });
  }, [catList, catTotal]);

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      {/* HERO */}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="hero-eyebrow">{monthLabelPt(year, month)} · {Math.max(0, daysLeftInMonth(year, month))} dias restantes</div>
          <h1 className="hero-h">
            Bom dia, <em>{first}.</em>
            <br />
            {stmt.loading ? (
              <Skeleton width={420} height={36} className="mt-2 inline-block" />
            ) : (
              <>
                Sua margem está em{' '}
                <em className={netResult < 0 ? 'text-red' : 'text-green'} style={{ color: netResult < 0 ? 'var(--red)' : 'var(--green)' }}>
                  {netResult < 0 ? '−R$ ' : '+R$ '}
                  {fmt(Math.abs(netResult), 0)}.
                </em>
              </>
            )}
          </h1>
          <p className="hero-note">
            Acompanhe sua receita, despesas e dívidas em tempo real. Os números aqui vêm direto das suas transações.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {deltaPct != null && (
            <span className={`hero-badge ${deltaPct >= 0 ? 'pos' : 'neg'}`}>
              <Ti name={deltaPct >= 0 ? 'trending-up' : 'trending-down'} />
              {deltaPct >= 0 ? '+' : ''}{deltaPct}% vs {monthLabelPt(prev.year, prev.month)}
            </span>
          )}
          {alertsCount > 0 && (
            <span className="hero-badge warn">
              <Ti name="alert-triangle" />
              {alertsCount} {alertsCount === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
        </div>
      </section>

      {/* ROW 1 — KPIs */}
      {widgets.kpis && (
      <section className="grid gap-3 dash-kpis" style={{ gridTemplateColumns: '2.2fr 1fr 1fr 1fr' }}>
        <article className="g tall" style={{ padding: '20px 22px' }}>
          <div className="g-label">
            Resultado líquido
            {deltaPct != null && (
              <span className={`g-tag ${deltaPct >= 0 ? 'pos' : 'neg'}`}>
                {deltaPct >= 0 ? '+' : ''}{deltaPct}% vs {monthLabelPt(prev.year, prev.month).split(' ')[0]}
              </span>
            )}
          </div>
          {stmt.loading ? (
            <Skeleton height={48} width="60%" />
          ) : (
            <div className={`g-val xl ${netResult < 0 ? 'neg' : 'pos'}`}>
              {netResult < 0 ? '− ' : ''}R$ {fmt(Math.abs(netResult), 0)}
            </div>
          )}
          <div className="g-sub">
            Receita R$ {fmt(totalIncome, 0)} · Despesas R$ {fmt(totalExpenses, 0)}
          </div>
          <div className="mt-3 flex-1 min-h-0">
            <ResultChart series={monthTx.data ?? []} />
          </div>
        </article>

        <KpiCard
          label="Receita"
          value={totalIncome}
          previous={stmtPrev.data?.total_income ?? 0}
          loading={stmt.loading}
          accent="#2ECC8A"
          tone="muted"
        />

        <KpiCard
          label="Despesas"
          value={totalExpenses}
          previous={stmtPrev.data?.total_expenses ?? 0}
          loading={stmt.loading}
          accent="#FF6B6B"
          tone="neg"
          invert
        />

        <article className="g">
          <div className="g-label">Reserva de emergência</div>
          {goals.loading ? (
            <Skeleton height={28} width="50%" />
          ) : reservePct != null ? (
            <div className="g-val muted md">{reservePct}%</div>
          ) : (
            <div className="g-val md muted">—</div>
          )}
          <div className="g-sub">
            {reserveGoal
              ? `R$ ${fmt(Number(reserveGoal.current_amount), 0)} / R$ ${fmt(Number(reserveGoal.target_amount), 0)}`
              : 'Crie uma meta de reserva'}
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <div
              className="bar-fill"
              style={{ width: `${reservePct ?? 0}%`, background: 'var(--slate)' }}
            />
          </div>
        </article>
      </section>
      )}

      {/* ROW 2 — Detail */}
      <section className="grid gap-3 dash-detail" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="flex flex-col gap-3">
          {widgets.attention && (
          <article className="g alert">
            <div className="g-label" style={{ color: 'var(--green)' }}>
              <Ti name="alert-circle" size={13} style={{ verticalAlign: '-1px' }} />
              Atenção do mês
            </div>
            {insightHighlight(insights.data, alertsCount, totalExpenses, totalIncome)}
            <button className="g-link" onClick={() => onNavigate('insights')}>
              Ver todos os insights <Ti name="arrow-right" />
            </button>
          </article>
          )}

          {widgets.categories && (
          <article className="g" style={{ padding: '20px 22px' }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="g-label" style={{ marginBottom: 4 }}>Gastos por categoria</div>
                <div className="text-[10.5px] text-text-3">
                  {monthLabelPt(year, month)} · {catList.length} {catList.length === 1 ? 'categoria' : 'categorias'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-[28px] leading-none text-text-1" style={{ letterSpacing: '-0.025em' }}>
                  R$ {fmt(catTotal, 0)}
                </div>
                <div className="text-[10px] text-text-4 mt-1">total no mês</div>
              </div>
            </div>

            {monthTx.loading ? (
              <Skeleton height={140} className="mt-3" />
            ) : donutSegs.length === 0 ? (
              <div className="text-[12px] text-text-3 mt-3">Nenhuma despesa registrada neste mês.</div>
            ) : (
              <>
                {/* Barra segmentada multicolor */}
                <div
                  className="flex w-full overflow-hidden mt-4"
                  style={{ height: 8, borderRadius: 999, background: 'var(--border-lt)' }}
                >
                  {catList.map((c) => (
                    <div
                      key={c.id}
                      title={`${c.name}: ${c.pct.toFixed(1)}%`}
                      style={{
                        width: `${c.pct}%`,
                        background: c.color,
                        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    />
                  ))}
                </div>

                {/* Donut + Lista */}
                <div className="flex items-center gap-5 mt-5">
                  <div className="relative flex-shrink-0">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <defs>
                        {donutSegs.map((s, i) => (
                          <linearGradient key={i} id={`gradCat${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
                            <stop offset="100%" stopColor={s.color} stopOpacity="0.7" />
                          </linearGradient>
                        ))}
                      </defs>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border-lt)" strokeWidth="11" />
                      {donutSegs.map((s, i) => {
                        const C = 2 * Math.PI * 38;
                        return (
                          <circle
                            key={i}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke={`url(#gradCat${i})`}
                            strokeWidth="11"
                            strokeLinecap="round"
                            strokeDasharray={`${Math.max(0, s.len - 1.5)} ${C - Math.max(0, s.len - 1.5)}`}
                            strokeDashoffset={s.offset}
                            transform="rotate(-90 50 50)"
                            style={{
                              transition: 'stroke-dasharray 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                          />
                        );
                      })}
                    </svg>
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    >
                      <div
                        className="font-serif text-[16px] leading-none text-text-1"
                        style={{ letterSpacing: '-0.02em' }}
                      >
                        {donutSegs[0]?.pct ?? 0}%
                      </div>
                      <div
                        className="text-[8.5px] uppercase text-text-4 mt-1"
                        style={{ letterSpacing: '0.1em' }}
                      >
                        {donutSegs[0]?.name?.slice(0, 10) ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2.5">
                    {catList.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <span
                          className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `${c.color}1A`,
                            color: c.color,
                          }}
                        >
                          <Ti name="point" size={10} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] text-text-1 font-medium truncate">{c.name}</span>
                            <span className="text-[11px] num-mono text-text-2">R$ {fmt(c.total, 0)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="flex-1 overflow-hidden"
                              style={{ height: 3, borderRadius: 3, background: 'var(--border-lt)' }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${c.pct}%`,
                                  background: c.color,
                                  borderRadius: 3,
                                  transition: 'width 0.6s ease',
                                }}
                              />
                            </div>
                            <span className="text-[10px] num-mono text-text-3" style={{ minWidth: 30, textAlign: 'right' }}>
                              {c.pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {catList.length > 5 && (
                      <div className="text-[10px] text-text-4 pt-1">
                        + {catList.length - 5} {catList.length - 5 === 1 ? 'categoria' : 'categorias'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {widgets.recent && (
          <article className="g">
            <div className="g-label">Transações recentes</div>
            {recent.loading ? (
              <div className="space-y-2 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </div>
            ) : !recent.data || recent.data.length === 0 ? (
              <EmptyState
                icon="transfer"
                title="Nenhuma transação ainda"
                description="Crie sua primeira transação para começar a ver seus números."
                cta={{ label: 'Nova transação', onClick: onNewTransaction }}
              />
            ) : (
              <>
                {recent.data.slice(0, 5).map((t) => {
                  const ico = pickIconFor(t);
                  const positive = t.type === 'income' || t.type === 'investment';
                  return (
                    <div className="tx" key={t.id}>
                      <div className={`tx-ico ${ico.tone}`}>
                        <Ti name={ico.name} />
                      </div>
                      <div className="tx-body">
                        <div className="tx-name">{t.description}</div>
                        <div className="tx-cat">
                          {t.category?.name ?? 'Sem categoria'} · {t.account?.name ?? 'Sem conta'}
                        </div>
                      </div>
                      <div className="tx-right">
                        <div className={`tx-amt ${positive ? 'pos' : 'neg'}`}>
                          {positive ? '+' : '-'}
                          {fmt(Number(t.amount), 2)}
                        </div>
                        <div className="tx-date">{formatDate(t.transaction_date)}</div>
                      </div>
                    </div>
                  );
                })}
                <button className="g-link" onClick={() => onNavigate('transactions')}>
                  Ver todas as transações <Ti name="arrow-right" />
                </button>
              </>
            )}
          </article>
          )}

          {widgets.debts && !debts.loading && totalDebt > 0 && (
            <article className="g danger-card">
              <div className="g-label" style={{ color: 'var(--text-3)' }}>
                <Ti name="credit-card" size={13} style={{ verticalAlign: '-1px' }} />
                Dívidas em aberto
                <span className="g-tag neg">{topDebts.length} ativas</span>
              </div>
              <div className="g-val neg md">R$ {fmt(totalDebt, 0)}</div>
              {topDebts.map((d) => {
                const pct = Number(d.original_amount) > 0
                  ? Math.min(100, (1 - Number(d.current_amount) / Number(d.original_amount)) * 100)
                  : 0;
                return (
                  <div className="goal-item" style={{ marginTop: 10 }} key={d.id}>
                    <div className="goal-header">
                      <span className="goal-name" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {d.creditor_name}
                      </span>
                      <span className="goal-vals">R$ {fmt(Number(d.current_amount), 0)}</span>
                    </div>
                    <div className="goal-bar">
                      <div className="goal-fill" style={{ width: `${pct}%`, background: 'var(--red)' }} />
                    </div>
                  </div>
                );
              })}
              <button className="g-link" onClick={() => onNavigate('debts')}>
                Detalhar dívidas <Ti name="arrow-right" />
              </button>
            </article>
          )}

          {debts.loading && <SkeletonCard height={160} />}
        </div>
      </section>
    </div>
  );
}

function ResultChart({ series }: { series: Transaction[] }) {
  // Build daily cumulative result array
  const days = useMemo(() => {
    const today = new Date();
    const totalDays = today.getDate();
    const arr = new Array(totalDays).fill(0);
    let running = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const t of series) {
        if (t.transaction_date !== dayStr || t.status === 'canceled') continue;
        const amt = Number(t.amount);
        if (t.type === 'income') running += amt;
        else if (t.type === 'expense' || t.type === 'debt_payment' || t.type === 'investment') running -= amt;
      }
      arr[d - 1] = running;
    }
    return arr;
  }, [series]);

  if (days.length === 0) return null;
  const min = Math.min(...days, 0);
  const max = Math.max(...days, 0);
  const range = (max - min) || 1;
  const W = 320;
  const H = 96;
  const stepX = days.length > 1 ? W / (days.length - 1) : W;
  const points = days.map((v, i) => {
    const x = i * stepX;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const last = points[points.length - 1];
  const lastVal = days[days.length - 1];
  const positive = lastVal >= 0;
  const stroke = positive ? '#0B6847' : '#B83A30';
  const stop1 = positive ? '#2ECC8A' : '#FF6B6B';

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="grdResultLive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stop1} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stop1} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grdLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.6" />
          <stop offset="100%" stopColor={stroke} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#grdResultLive)" />
      <path
        d={linePath}
        fill="none"
        stroke="url(#grdLine)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        <>
          <circle cx={last[0]} cy={last[1]} r="6" fill={stroke} fillOpacity="0.18" />
          <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
        </>
      )}
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  previous: number;
  loading: boolean;
  accent: string;
  tone: 'pos' | 'neg' | 'muted';
  invert?: boolean; // when increase is bad (Despesas)
}

function KpiCard({ label, value, previous, loading, accent, tone, invert }: KpiCardProps) {
  const fmt0 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const delta = previous ? Math.round(((value - previous) / Math.abs(previous)) * 100) : null;
  const isUp = (delta ?? 0) >= 0;
  const goodDirection = invert ? !isUp : isUp;
  const valColor = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : 'var(--slate)';

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
          style={{ fontSize: 28, color: valColor, letterSpacing: '-0.025em' }}
        >
          {fmt0(value)}
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        {delta != null ? (
          <span
            className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-pill"
            style={{
              background: goodDirection ? 'var(--green-lt)' : 'var(--red-lt)',
              color: goodDirection ? 'var(--green)' : 'var(--red)',
            }}
          >
            <Ti name={isUp ? 'trending-up' : 'trending-down'} size={11} />
            {isUp ? '+' : ''}
            {delta}%
          </span>
        ) : (
          <span className="text-[10px] text-text-4">sem histórico</span>
        )}
        <span className="text-[10px] text-text-4">vs mês anterior</span>
      </div>
    </article>
  );
}

function insightHighlight(
  insights: any[] | null,
  alertsCount: number,
  expenses: number,
  income: number
) {
  const top = (insights ?? []).find((i) => !i.is_read && (i.severity === 'warning' || i.severity === 'danger'));
  if (top) {
    return (
      <p className="text-[12px] text-text-2 leading-[1.7]">
        <strong className="text-text-1">{top.title}</strong> — {top.description}
      </p>
    );
  }
  if (income && expenses / income > 0.8) {
    return (
      <p className="text-[12px] text-text-2 leading-[1.7]">
        Você usou <strong className="text-text-1">{Math.round((expenses / income) * 100)}%</strong> da receita do mês.
        Considerando os fixos restantes, atenção à projeção de fechamento.
      </p>
    );
  }
  return (
    <p className="text-[12px] text-text-2 leading-[1.7]">
      Tudo sob controle por aqui. Continue lançando suas transações pra manter os números fiéis.
    </p>
  );
}

function daysLeftInMonth(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return last;
  return last - today.getDate();
}


function formatDate(d: string) {
  const [y, m, dd] = d.split('-');
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${dd} ${months[Number(m) - 1]}`;
}

// silence no-unused warning for imports
void monthRange;
