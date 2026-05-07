import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import TransactionModal from '../components/TransactionModal';
import { useToast } from '../components/Toast';
import { markTransactionPaid, useTransactions } from '../lib/data';
import { useDebounced } from '../lib/useDebounced';
import type { Transaction, TransactionStatus, TransactionType } from '../lib/types';

interface Props {
  onNewTransaction: () => void;
  refreshKey?: number;
}

const typeLabel: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
  debt_payment: 'Dívida',
  investment: 'Investimento',
};

const typeChip: Record<TransactionType, string> = {
  income: 'g-tag pos',
  expense: 'g-tag neg',
  transfer: 'g-tag info',
  debt_payment: 'g-tag warn',
  investment: 'g-tag info',
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

type TabId = 'realized' | 'upcoming' | 'all';
const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'realized', label: 'Realizadas' },
  { id: 'upcoming', label: 'Próximos' },
  { id: 'all', label: 'Todas' },
];

const typeFilters: Array<{ id: string; label: string; type?: TransactionType }> = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'income', label: 'Receita', type: 'income' },
  { id: 'expense', label: 'Despesa', type: 'expense' },
  { id: 'debt_payment', label: 'Dívida', type: 'debt_payment' },
];

function pickIconFor(t: Transaction): { name: string; tone: 'in' | 'out' | 'neutral' } {
  if (t.type === 'income') return { name: 'arrow-down-right', tone: 'in' };
  if (t.type === 'investment') return { name: 'trending-up', tone: 'in' };
  if (t.type === 'transfer') return { name: 'transfer', tone: 'neutral' };
  if (t.category?.icon) return { name: t.category.icon, tone: 'out' };
  return { name: 'arrow-up-right', tone: 'out' };
}

function statusChip(status: TransactionStatus): { label: string; cls: string } | null {
  switch (status) {
    case 'planned':
      return { label: 'Planejado', cls: 'g-tag info' };
    case 'pending':
      return { label: 'Pendente', cls: 'g-tag warn' };
    case 'canceled':
      return { label: 'Cancelado', cls: 'g-tag' };
    default:
      return null;
  }
}

export default function TransactionsPage({ onNewTransaction, refreshKey = 0 }: Props) {
  const [tab, setTab] = useState<TabId>('realized');
  const [typeId, setTypeId] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const toast = useToast();

  const typeDef = typeFilters.find((f) => f.id === typeId)!;

  const txQueryOpts = useMemo(() => {
    const base: any = { type: typeDef.type, limit: 200 };
    if (tab === 'realized') {
      base.excludeStatus = ['canceled', 'planned'];
    } else if (tab === 'upcoming') {
      base.status = 'planned';
      base.ascending = true;
    } else {
      base.excludeStatus = 'canceled';
    }
    return base;
  }, [tab, typeDef.type]);

  const { data: txs, loading, refresh } = useTransactions(txQueryOpts);

  useEffect(() => {
    if (!refreshKey) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const dq = useDebounced(q, 220);
  const filtered = useMemo(() => {
    if (!txs) return [];
    if (!dq) return txs;
    return txs.filter((t) => t.description.toLowerCase().includes(dq.toLowerCase()));
  }, [txs, dq]);

  const totalIn = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered
    .filter((t) => t.type === 'expense' || t.type === 'debt_payment' || t.type === 'investment')
    .reduce((s, t) => s + Number(t.amount), 0);

  const upcomingByMonth = useMemo(() => {
    if (tab !== 'upcoming') return null;
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = t.transaction_date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, tab]);

  const handleQuickPay = async (e: React.MouseEvent, t: Transaction) => {
    e.stopPropagation();
    setPaying(t.id);
    try {
      const today = todayISO();
      const paidDate = t.transaction_date > today ? today : undefined;
      await markTransactionPaid(t.id, paidDate);
      toast.success('Marcado como pago', t.description);
      refresh();
    } catch (err: any) {
      toast.error('Erro ao marcar como pago', err.message);
    } finally {
      setPaying(null);
    }
  };

  const heroTitle =
    tab === 'upcoming'
      ? `Próximos lançamentos. ${filtered.length} planejados.`
      : tab === 'realized'
        ? `Transações realizadas. ${filtered.length}.`
        : `Todas as transações. ${filtered.length}.`;

  const heroNote =
    tab === 'upcoming' ? (
      <>
        previstas <strong className="text-green">+R$ {fmt(totalIn)}</strong> · saídas previstas{' '}
        <strong className="text-red">−R$ {fmt(totalOut)}</strong>
      </>
    ) : (
      <>
        entradas <strong className="text-green">+R$ {fmt(totalIn)}</strong> · saídas{' '}
        <strong className="text-red">−R$ {fmt(totalOut)}</strong>
      </>
    );

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="II — Movimentos"
        title={heroTitle}
        note={heroNote}
        badges={
          <button className="tb-btn" onClick={onNewTransaction}>
            <Ti name="plus" />
            Novo
          </button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="inline-flex p-[3px] rounded-pill"
          style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                style={
                  active
                    ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                    : { color: 'var(--text-3)' }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div
          className="inline-flex p-[3px] rounded-pill"
          style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
        >
          {typeFilters.map((f) => {
            const active = typeId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setTypeId(f.id)}
                className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                style={
                  active
                    ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                    : { color: 'var(--text-3)' }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="relative ml-auto">
          <Ti name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-4" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar lançamento"
            className="field-input"
            style={{ paddingLeft: 30, width: 240 }}
          />
        </div>
      </div>

      {loading ? (
        <article className="g" style={{ padding: 18 }}>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        </article>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? 'calendar' : 'transfer'}
          title={
            q
              ? 'Nenhum resultado'
              : tab === 'upcoming'
                ? 'Sem lançamentos futuros'
                : 'Sem transações ainda'
          }
          description={
            q
              ? 'Tente outra busca.'
              : tab === 'upcoming'
                ? 'Crie um lançamento com data futura ou cadastre uma despesa fixa em Recorrentes.'
                : 'Crie sua primeira transação para começar a acompanhar.'
          }
          cta={!q ? { label: 'Nova transação', onClick: onNewTransaction } : undefined}
        />
      ) : tab === 'upcoming' && upcomingByMonth ? (
        <div className="flex flex-col gap-3">
          {upcomingByMonth.map(([monthKey, items]) => (
            <UpcomingMonthCard
              key={monthKey}
              monthKey={monthKey}
              items={items}
              onPick={setEditing}
              onQuickPay={handleQuickPay}
              paying={paying}
            />
          ))}
        </div>
      ) : (
        <article className="g" style={{ padding: '4px 20px 16px' }}>
          <div
            className="grid items-center gap-3 g-label"
            style={{
              gridTemplateColumns: '36px 60px 1fr 130px 100px 140px',
              paddingTop: 14,
              paddingBottom: 10,
              marginBottom: 0,
              borderBottom: '0.5px solid var(--border-lt)',
            }}
          >
            <span></span>
            <span>Dia</span>
            <span>Lançamento</span>
            <span>Tipo</span>
            <span>Status</span>
            <span className="text-right">Valor</span>
          </div>
          <ul>
            {filtered.map((t) => {
              const ico = pickIconFor(t);
              const positive = t.type === 'income' || t.type === 'investment';
              const day = t.transaction_date.slice(8, 10);
              const sChip = statusChip(t.status);
              return (
                <li
                  key={t.id}
                  onClick={() => setEditing(t)}
                  className="grid items-center gap-3 hover:bg-bg/60 transition-colors cursor-pointer"
                  style={{
                    gridTemplateColumns: '36px 60px 1fr 130px 100px 140px',
                    padding: '12px 0',
                    borderBottom: '0.5px solid var(--border-lt)',
                    opacity: t.status === 'planned' ? 0.85 : 1,
                  }}
                >
                  <div className={`tx-ico ${ico.tone}`} style={{ width: 32, height: 32, fontSize: 14 }}>
                    <Ti name={ico.name} />
                  </div>
                  <span className="font-serif text-base text-text-2 num-mono">{day}</span>
                  <div className="min-w-0">
                    <div className="tx-name">{t.description}</div>
                    <div className="tx-cat">
                      {t.category?.name ?? '—'} · {t.account?.name ?? '—'}
                    </div>
                  </div>
                  <div>
                    <span className={typeChip[t.type]}>{typeLabel[t.type]}</span>
                  </div>
                  <div>{sChip ? <span className={sChip.cls}>{sChip.label}</span> : <span className="text-text-4 text-[11px]">Pago</span>}</div>
                  <div className={`text-right num-mono text-[12.5px] ${positive ? 'text-green' : 'text-red'}`}>
                    {positive ? '+' : '−'} {fmt(Math.abs(Number(t.amount)))}
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      )}

      <TransactionModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={() => refresh()}
      />
    </div>
  );
}

interface UpcomingMonthCardProps {
  monthKey: string;
  items: Transaction[];
  onPick: (t: Transaction) => void;
  onQuickPay: (e: React.MouseEvent, t: Transaction) => void;
  paying: string | null;
}

function UpcomingMonthCard({ monthKey, items, onPick, onQuickPay, paying }: UpcomingMonthCardProps) {
  const [y, m] = monthKey.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());

  const totalIn = items.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = items
    .filter((t) => t.type === 'expense' || t.type === 'debt_payment' || t.type === 'investment')
    .reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIn - totalOut;

  const today = todayISO();

  return (
    <article className="g" style={{ padding: '14px 20px 16px' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="g-label" style={{ marginBottom: 2 }}>
            {monthLabel}
          </div>
          <div className="text-[11px] text-text-4">
            {items.length} {items.length === 1 ? 'lançamento' : 'lançamentos'}
          </div>
        </div>
        <div className="text-right">
          <div className={`num-mono text-[13px] ${net >= 0 ? 'text-green' : 'text-red'}`}>
            {net >= 0 ? '+' : '−'} R$ {fmt(Math.abs(net))}
          </div>
          <div className="text-[10px] text-text-4">resultado projetado</div>
        </div>
      </div>
      <ul>
        {items.map((t) => {
          const ico = pickIconFor(t);
          const positive = t.type === 'income' || t.type === 'investment';
          const day = t.transaction_date.slice(8, 10);
          const overdue = t.transaction_date < today;
          return (
            <li
              key={t.id}
              onClick={() => onPick(t)}
              className="grid items-center gap-3 hover:bg-bg/60 transition-colors cursor-pointer"
              style={{
                gridTemplateColumns: '36px 60px 1fr 110px 100px 100px',
                padding: '10px 0',
                borderTop: '0.5px solid var(--border-lt)',
              }}
            >
              <div className={`tx-ico ${ico.tone}`} style={{ width: 32, height: 32, fontSize: 14 }}>
                <Ti name={ico.name} />
              </div>
              <span className="font-serif text-base text-text-2 num-mono">{day}</span>
              <div className="min-w-0">
                <div className="tx-name">{t.description}</div>
                <div className="tx-cat">
                  {t.category?.name ?? '—'} · {t.account?.name ?? '—'}
                </div>
              </div>
              <div className={`text-right num-mono text-[12.5px] ${positive ? 'text-green' : 'text-red'}`}>
                {positive ? '+' : '−'} {fmt(Math.abs(Number(t.amount)))}
              </div>
              <div>
                {overdue ? (
                  <span className="g-tag neg">Atrasado</span>
                ) : (
                  <span className="g-tag info">Planejado</span>
                )}
              </div>
              <div className="text-right">
                <button
                  onClick={(e) => onQuickPay(e, t)}
                  disabled={paying === t.id}
                  className="text-[11px] px-2.5 py-1 rounded-pill transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                  style={{
                    background: 'var(--green-lt)',
                    color: 'var(--green)',
                    border: '0.5px solid var(--green-md)',
                  }}
                >
                  <Ti name="check" size={11} />
                  {paying === t.id ? '...' : 'Marcar pago'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
