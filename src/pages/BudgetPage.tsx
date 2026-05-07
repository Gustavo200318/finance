import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import RowActions from '../components/RowActions';
import BudgetModal from '../components/forms/BudgetModal';
import { currentMonth, useBudgets, useMonthTransactions } from '../lib/data';
import type { Budget } from '../lib/types';

interface Props {
  refreshKey?: number;
}

function statusFor(spent: number, budget: number) {
  if (budget <= 0) return { tag: 'g-tag info', label: '—', bar: 'var(--slate)', width: 0, pct: 0 };
  const pct = spent / budget;
  if (pct > 1)
    return { tag: 'g-tag neg', label: `+${Math.round((pct - 1) * 100)}%`, bar: 'var(--red)', width: 100, pct };
  if (pct >= 0.9)
    return { tag: 'g-tag warn', label: `${Math.round(pct * 100)}%`, bar: '#D4A020', width: pct * 100, pct };
  return { tag: 'g-tag pos', label: 'OK', bar: 'var(--green)', width: pct * 100, pct };
}

const fmt = (v: number) => v.toLocaleString('pt-BR');

export default function BudgetPage({ refreshKey = 0 }: Props) {
  const { year, month } = currentMonth();
  const budgets = useBudgets(year, month);
  const monthTx = useMonthTransactions(year, month);
  const [modal, setModal] = useState<{ open: boolean; budget: Budget | null }>({ open: false, budget: null });

  useEffect(() => {
    if (!refreshKey) return;
    budgets.refresh();
    monthTx.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const rows = useMemo(() => {
    if (!budgets.data) return [];
    return budgets.data.map((b) => {
      const realized = (monthTx.data ?? [])
        .filter((t) => t.category_id === b.category_id && t.type === 'expense' && t.status !== 'canceled')
        .reduce((s, t) => s + Number(t.amount), 0);
      return {
        id: b.id,
        budget: b,
        name: b.category?.name ?? 'Categoria',
        icon: b.category?.icon ?? 'circle',
        spent: realized,
        plan: Number(b.planned_amount),
      };
    });
  }, [budgets.data, monthTx.data]);

  const planned = rows.reduce((s, r) => s + r.plan, 0);
  const realized = rows.reduce((s, r) => s + r.spent, 0);
  const exceeded = rows.filter((r) => r.spent > r.plan);
  const used = planned > 0 ? (realized / planned) * 100 : 0;

  const loading = budgets.loading || monthTx.loading;
  const onSaved = () => budgets.refresh();

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow={`III — Plano · ${monthLabel(year, month)}`}
        title={
          <>
            Orçamento<br />
            <em>contra o real.</em>
          </>
        }
        note="O orçamento não é jaula — é intenção. Aqui você vê quais resistiram ao mês."
        badges={
          <button className="tb-btn" onClick={() => setModal({ open: true, budget: null })}>
            <Ti name="plus" />
            Adicionar categoria
          </button>
        }
      />

      {loading ? (
        <SkeletonCard height={120} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="chart-pie"
          title="Nenhum orçamento configurado"
          description={`Defina valores planejados por categoria para ${monthLabel(year, month)} e acompanhe o realizado em tempo real.`}
          cta={{ label: 'Adicionar categoria', onClick: () => setModal({ open: true, budget: null }) }}
        />
      ) : (
        <>
          <section className="grid gap-3" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
            <article className="g">
              <div className="g-label">Sumário do mês</div>
              <div className={`g-val xl ${realized > planned ? 'neg' : 'pos'}`}>
                {used.toFixed(0)}<span className="text-text-3 text-[28px]">%</span>
              </div>
              <div className="g-sub">
                do orçamento de <strong className="text-text-1">R$ {fmt(planned)}</strong> consumido
              </div>
            </article>

            <article className="g">
              <div className="g-label">Planejado vs realizado</div>
              <div className="flex items-baseline gap-3 mt-1">
                <div className="g-val md muted">R$ {fmt(planned)}</div>
                <Ti name="arrow-right" size={14} className="text-text-4" />
                <div className={`g-val md ${realized > planned ? 'neg' : 'pos'}`}>R$ {fmt(realized)}</div>
              </div>
              <div className="g-sub">
                Diferença{' '}
                <strong className={realized > planned ? 'text-red' : 'text-green'}>
                  R$ {fmt(Math.abs(realized - planned))}
                </strong>
              </div>
            </article>

            <article className="g">
              <div className="g-label">Categorias estouradas</div>
              <div className={`g-val md ${exceeded.length ? 'neg' : 'pos'}`}>
                {exceeded.length}
                <span className="text-text-3"> / {rows.length}</span>
              </div>
              <div className="g-sub">{exceeded.length > 0 ? exceeded.map((r) => r.name).join(', ') : 'Tudo dentro'}</div>
            </article>
          </section>

          <article className="g" style={{ padding: '4px 20px 16px' }}>
            <div
              className="row-compact row-compact-header grid items-center g-label"
              style={{
                gridTemplateColumns: '36px 1fr 90px 1fr 160px 36px',
                gap: 12,
                paddingTop: 14,
                paddingBottom: 10,
                marginBottom: 0,
                borderBottom: '0.5px solid var(--border-lt)',
              }}
            >
              <span></span>
              <span>Categoria</span>
              <span>Status</span>
              <span>Progresso</span>
              <span className="text-right">Realizado / Plano</span>
              <span></span>
            </div>
            <ul>
              {rows.map((r) => {
                const s = statusFor(r.spent, r.plan);
                return (
                  <li
                    key={r.id}
                    className="row-compact grid items-center hover:bg-bg/60 transition-colors"
                    style={{
                      gridTemplateColumns: '36px 1fr 90px 1fr 160px 36px',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: '0.5px solid var(--border-lt)',
                    }}
                  >
                    <div className="tx-ico neutral" style={{ width: 30, height: 30, fontSize: 13 }}>
                      <Ti name={r.icon} />
                    </div>
                    <span className="text-[12.5px] text-text-1 font-medium">{r.name}</span>
                    <span className="col-secondary">
                      <span className={s.tag}>{s.label}</span>
                    </span>
                    <div className="col-secondary bar">
                      <div className="bar-fill" style={{ width: `${Math.min(100, s.width)}%`, background: s.bar }} />
                    </div>
                    <div className="text-right text-[12px] num-mono">
                      <span className="text-text-1 font-medium">R$ {fmt(r.spent)}</span>
                      <span className="text-text-4"> / {fmt(r.plan)}</span>
                    </div>
                    <div className="col-secondary">
                      <RowActions
                        actions={[
                          { label: 'Editar', icon: 'pencil', onClick: () => setModal({ open: true, budget: r.budget }) },
                          { label: 'Excluir', icon: 'trash', onClick: () => setModal({ open: true, budget: r.budget }), destructive: true },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </>
      )}

      <BudgetModal
        open={modal.open}
        onClose={() => setModal({ open: false, budget: null })}
        onSaved={onSaved}
        initial={modal.budget}
        defaultMonth={month}
        defaultYear={year}
      />
    </div>
  );
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());
}
