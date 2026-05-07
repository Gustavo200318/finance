import React, { useEffect, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import RowActions from '../components/RowActions';
import GoalModal from '../components/forms/GoalModal';
import { useGoals } from '../lib/data';
import type { Goal, GoalType } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const goalTypeMeta: Record<GoalType, { tag: string; bar: string; soft: string; valTone: string; label: string }> = {
  emergency_fund: { tag: 'g-tag info', bar: 'var(--slate)', soft: '#EBF2FB', valTone: 'muted', label: 'Reserva' },
  debt_free: { tag: 'g-tag warn', bar: '#D4A020', soft: 'var(--amber-lt)', valTone: '', label: 'Quitação' },
  investment: { tag: 'g-tag info', bar: 'var(--slate)', soft: '#EBF2FB', valTone: 'muted', label: 'Investimento' },
  purchase: { tag: 'g-tag warn', bar: '#D4A020', soft: 'var(--amber-lt)', valTone: '', label: 'Compra' },
  custom: { tag: 'g-tag info', bar: 'var(--slate)', soft: '#EBF2FB', valTone: 'muted', label: 'Meta' },
};

const fmt = (v: number) => v.toLocaleString('pt-BR');

function deadlineLabel(g: Goal): string {
  if (g.status === 'completed') return 'Concluída';
  if (g.deadline) {
    const [y, m] = g.deadline.split('-');
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `Até ${months[Number(m) - 1]} de ${y}`;
  }
  return 'Sem prazo';
}

export default function GoalsPage({ refreshKey = 0 }: Props) {
  const { data, loading, refresh } = useGoals();
  const [modal, setModal] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });

  useEffect(() => {
    if (!refreshKey) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const goals = data ?? [];
  const onSaved = () => refresh();

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="III — Plano · Bússola"
        title={
          <>
            Metas, <em>como bússola.</em>
          </>
        }
        note="Liberdade financeira é a soma de pequenas decisões consistentes. Aqui está o seu mapa."
        badges={
          <button className="tb-btn" onClick={() => setModal({ open: true, goal: null })}>
            <Ti name="plus" />
            Nova meta
          </button>
        }
      />

      {loading ? (
        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
        </section>
      ) : goals.length === 0 ? (
        <EmptyState
          icon="target"
          title="Nenhuma meta ainda"
          description="Crie sua primeira meta — reserva, quitação de dívida, compra ou investimento."
          cta={{ label: 'Nova meta', onClick: () => setModal({ open: true, goal: null }) }}
        />
      ) : (
        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {goals.map((g, idx) => {
            const t = goalTypeMeta[g.type];
            const target = Number(g.target_amount) || 1;
            const current = Number(g.current_amount);
            const pct = (current / target) * 100;
            const done = g.status === 'completed';
            return (
              <article key={g.id} className="g tall">
                <div className="flex items-start justify-between mb-3">
                  <div className="font-serif text-[26px] text-text-4 num-mono leading-none">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={t.tag}>
                      {done && <Ti name="check" size={10} />}
                      {done ? 'Concluída' : t.label}
                    </span>
                    <RowActions
                      actions={[
                        { label: 'Editar', icon: 'pencil', onClick: () => setModal({ open: true, goal: g }) },
                        { label: 'Excluir', icon: 'trash', onClick: () => setModal({ open: true, goal: g }), destructive: true },
                      ]}
                    />
                  </div>
                </div>

                <div className="font-serif text-[20px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                  {g.name}
                </div>
                <div className="text-[10.5px] text-text-4 mt-1">{deadlineLabel(g)}</div>

                <div className="mt-4 flex items-end justify-between">
                  <div className={`g-val md ${t.valTone}`}>{Math.round(pct)}%</div>
                  <div className="text-[10.5px] text-text-3 num-mono">
                    R$ {fmt(current)} / {fmt(Number(g.target_amount))}
                  </div>
                </div>

                <div className="bar mt-2" style={{ height: 5 }}>
                  <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: t.bar }} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      <GoalModal
        open={modal.open}
        onClose={() => setModal({ open: false, goal: null })}
        onSaved={onSaved}
        initial={modal.goal}
      />
    </div>
  );
}
