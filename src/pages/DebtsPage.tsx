import React, { useEffect, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import RowActions from '../components/RowActions';
import DebtModal from '../components/forms/DebtModal';
import DebtPaymentModal from '../components/forms/DebtPaymentModal';
import { useDebts } from '../lib/data';
import type { Debt } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const tones = (d: Debt) => {
  if (d.priority >= 3 || d.status === 'overdue')
    return { tag: 'g-tag neg', color: 'var(--red)', card: 'danger-card', label: 'Alta' };
  if (d.priority === 2) return { tag: 'g-tag warn', color: '#D4A020', card: 'warn-card', label: 'Média' };
  return { tag: 'g-tag info', color: 'var(--slate)', card: '', label: 'Baixa' };
};

export default function DebtsPage({ refreshKey = 0 }: Props) {
  const debts = useDebts();
  const [debtModal, setDebtModal] = useState<{ open: boolean; debt: Debt | null }>({ open: false, debt: null });
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; debt: Debt | null }>({ open: false, debt: null });

  useEffect(() => {
    if (!refreshKey) return;
    debts.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const list = (debts.data ?? []).filter((d) => d.status !== 'paid');
  const total = list.reduce((s, d) => s + Number(d.current_amount), 0);
  const original = list.reduce((s, d) => s + Number(d.original_amount), 0);
  const paid = original > 0 ? ((original - total) / original) * 100 : 0;

  const onSaved = () => debts.refresh();

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="III — Plano · Passivos"
        title={
          <>
            Suas dívidas,<br />
            <em>vistas como projeto.</em>
          </>
        }
        note="Cada linha tem fim. Pagar juros altos primeiro libera renda futura."
        badges={
          <button className="tb-btn" onClick={() => setDebtModal({ open: true, debt: null })}>
            <Ti name="plus" />
            Registrar dívida
          </button>
        }
      />

      {debts.loading ? (
        <SkeletonCard height={140} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nenhuma dívida em aberto"
          description="Você está livre de dívidas registradas. Mantenha o ritmo."
          cta={{ label: 'Registrar dívida', onClick: () => setDebtModal({ open: true, debt: null }) }}
        />
      ) : (
        <>
          <section className="grid gap-3" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
            <article className="g danger-card tall">
              <div className="g-label">
                Total em aberto
                <span className="g-tag neg">{list.length} ativas</span>
              </div>
              <div className="g-val xl neg">R$ {total.toLocaleString('pt-BR')}</div>
              <p className="g-sub">Saldo devedor consolidado entre as {list.length} dívidas ativas.</p>
            </article>

            <article className="g tall">
              <div className="g-label">Quitado do total original</div>
              <div className="g-val md pos">{paid.toFixed(0)}%</div>
              <div className="bar mt-3">
                <div className="bar-fill" style={{ width: `${paid}%`, background: 'var(--green)' }} />
              </div>
              <div className="g-sub">
                R$ {(original - total).toLocaleString('pt-BR')} pagos · R$ {original.toLocaleString('pt-BR')} originais
              </div>
            </article>
          </section>

          <section className="flex flex-col gap-3">
            {list.map((d, idx) => {
              const t = tones(d);
              const pct = Number(d.original_amount) > 0
                ? ((Number(d.original_amount) - Number(d.current_amount)) / Number(d.original_amount)) * 100
                : 0;
              return (
                <article key={d.id} className={`g ${t.card}`}>
                  <div className="grid gap-5" style={{ gridTemplateColumns: '40px 1fr 200px 36px' }}>
                    <div className="font-serif text-[28px] text-text-4 num-mono leading-none mt-1">
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    <div>
                      <div className="g-label" style={{ marginBottom: 6 }}>
                        <span className={t.tag}>Prioridade {t.label}</span>
                        {d.renegotiation_available && <span className="g-tag info">Renegociação</span>}
                      </div>
                      <div className="font-serif text-[17px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                        {d.creditor_name}
                      </div>
                      <div className="text-[10.5px] text-text-4 mt-0.5">
                        {d.interest_rate ? `Juros ${Number(d.interest_rate)}% a.m.` : 'Sem juros informados'}
                        {d.due_date ? ` · Vence ${formatDate(d.due_date)}` : ''}
                      </div>
                      <div className="bar mt-3">
                        <div className="bar-fill" style={{ width: `${pct}%`, background: t.color }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-4 mt-1.5">
                        <span>{pct.toFixed(0)}% quitado</span>
                        <span>Status: {d.status}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="g-label" style={{ marginBottom: 6 }}>
                        Saldo devedor
                      </div>
                      <div className="g-val md" style={{ color: t.color }}>
                        R$ {Number(d.current_amount).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-text-4 mt-0.5">
                        Original R$ {Number(d.original_amount).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    <div>
                      <RowActions
                        actions={[
                          { label: 'Registrar pagamento', icon: 'cash', onClick: () => setPaymentModal({ open: true, debt: d }) },
                          { label: 'Editar', icon: 'pencil', onClick: () => setDebtModal({ open: true, debt: d }) },
                          { label: 'Excluir', icon: 'trash', onClick: () => setDebtModal({ open: true, debt: d }), destructive: true },
                        ]}
                      />
                    </div>
                  </div>

                  {d.notes && (
                    <div
                      className="mt-4 px-3 py-2.5 rounded-[10px] flex items-start gap-2"
                      style={{ background: 'var(--red-lt)', color: 'var(--red)', fontSize: 11.5 }}
                    >
                      <Ti name="alert-circle" size={13} className="mt-0.5 shrink-0" />
                      <span>{d.notes}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}

      <DebtModal
        open={debtModal.open}
        onClose={() => setDebtModal({ open: false, debt: null })}
        onSaved={onSaved}
        initial={debtModal.debt}
      />
      <DebtPaymentModal
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, debt: null })}
        onSaved={onSaved}
        debt={paymentModal.debt}
      />
    </div>
  );
}

function formatDate(d: string) {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y.slice(2)}`;
}
