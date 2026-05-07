import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import RowActions from '../components/RowActions';
import AccountModal from '../components/forms/AccountModal';
import { accountBalanceFromTx, useAccounts, useTransactions } from '../lib/data';
import type { Account, AccountType } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const typeMeta: Record<
  AccountType,
  { label: string; icon: string; iconTone: 'in' | 'out' | 'neutral' }
> = {
  checking: { label: 'Conta corrente', icon: 'building-bank', iconTone: 'neutral' },
  savings: { label: 'Poupança', icon: 'pig-money', iconTone: 'neutral' },
  cash: { label: 'Dinheiro físico', icon: 'cash', iconTone: 'neutral' },
  credit_card: { label: 'Cartão de crédito', icon: 'credit-card', iconTone: 'out' },
  investment: { label: 'Investimentos', icon: 'chart-line', iconTone: 'in' },
  debt: { label: 'Dívida', icon: 'alert-triangle', iconTone: 'out' },
  other: { label: 'Outra', icon: 'wallet', iconTone: 'neutral' },
};

const fmt = (v: number) => Math.abs(v).toLocaleString('pt-BR');

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`)
    .join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function buildHistory(account: Account, txs: any[]): number[] {
  const today = new Date();
  const buckets: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const cutoff = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
    const txsUntil = txs.filter((t) => t.transaction_date <= cutoff);
    buckets.push(accountBalanceFromTx(account, txsUntil));
  }
  return buckets;
}

export default function AccountsPage({ refreshKey = 0 }: Props) {
  const accounts = useAccounts();
  const txs = useTransactions({ limit: 1000 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  useEffect(() => {
    if (!refreshKey) return;
    accounts.refresh();
    txs.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const total = useMemo(() => {
    if (!accounts.data || !txs.data) return 0;
    return accounts.data
      .filter((a) => a.is_active)
      .reduce((s, a) => s + accountBalanceFromTx(a, txs.data!), 0);
  }, [accounts.data, txs.data]);

  const loading = accounts.loading;
  const list = accounts.data ?? [];

  const onCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const onEdit = (a: Account) => {
    setEditing(a);
    setModalOpen(true);
  };
  const onSaved = () => {
    accounts.refresh();
    txs.refresh();
  };

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="II — Movimentos"
        title={
          <>
            Patrimônio<br />
            <em>R$ {total.toLocaleString('pt-BR')}.</em>
          </>
        }
        note={`${list.length} ${list.length === 1 ? 'conta vinculada' : 'contas vinculadas'}. Cada uma tem seu papel.`}
        badges={
          <button className="tb-btn" onClick={onCreate}>
            <Ti name="plus" />
            Adicionar conta
          </button>
        }
      />

      {loading ? (
        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <SkeletonCard height={220} />
          <SkeletonCard height={220} />
          <SkeletonCard height={220} />
        </section>
      ) : list.length === 0 ? (
        <EmptyState
          icon="building-bank"
          title="Nenhuma conta cadastrada"
          description="Crie suas contas (banco, cartão, carteira) para começar a acompanhar saldos e movimentações."
          cta={{ label: 'Adicionar conta', onClick: onCreate }}
        />
      ) : (
        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {list.map((a) => {
            const meta = typeMeta[a.type];
            const balance = txs.data ? accountBalanceFromTx(a, txs.data) : Number(a.current_balance);
            const history = txs.data ? buildHistory(a, txs.data) : [];
            const negative = balance < 0;
            return (
              <article key={a.id} className="g tall">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="g-label" style={{ marginBottom: 6 }}>
                      {meta.label}
                    </div>
                    <div className="font-serif text-[18px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                      {a.name}
                    </div>
                    <div className="text-[10px] text-text-4 mt-0.5">{a.institution || '—'}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <RowActions
                      actions={[
                        { label: 'Editar', icon: 'pencil', onClick: () => onEdit(a) },
                        { label: 'Excluir', icon: 'trash', onClick: () => onEdit(a), destructive: true },
                      ]}
                    />
                    <div className={`tx-ico ${meta.iconTone}`}>
                      <Ti name={meta.icon} />
                    </div>
                  </div>
                </div>

                <div className={`g-val md ${negative ? 'neg' : 'muted'}`}>
                  {negative && '− '}R$ {fmt(balance)}
                </div>

                <MiniSpark data={history} color={negative ? '#B83A30' : '#2E4D65'} />

                <div
                  className="mt-3 pt-3 flex items-center justify-between"
                  style={{ borderTop: '0.5px solid var(--border-lt)' }}
                >
                  <span className={`g-tag ${a.is_active ? 'pos' : 'info'}`}>
                    {a.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                  <button onClick={() => onEdit(a)} className="g-link" style={{ marginTop: 0, paddingTop: 0 }}>
                    Editar <Ti name="arrow-right" />
                  </button>
                </div>
              </article>
            );
          })}

          <button
            className="g flex flex-col items-center justify-center text-text-3 hover:text-text-1 transition-colors"
            style={{ borderStyle: 'dashed', minHeight: 220 }}
            onClick={onCreate}
          >
            <span
              className="h-10 w-10 rounded-full mb-2 flex items-center justify-center"
              style={{ border: '0.5px dashed var(--border)' }}
            >
              <Ti name="plus" size={16} />
            </span>
            <span className="font-serif text-[16px] text-text-2">Nova conta</span>
            <span className="text-2xs uppercase text-text-4 mt-1.5" style={{ letterSpacing: '0.12em' }}>
              Banco · Cartão · Carteira
            </span>
          </button>
        </section>
      )}

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
        initial={editing}
      />
    </div>
  );
}
