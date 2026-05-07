import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import RecurringModal from '../components/forms/RecurringModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { materializeAllRecurring, nextOccurrence, useRecurring } from '../lib/data';
import type { RecurrenceFrequency, RecurringTransaction, TransactionType } from '../lib/types';

interface Props {
  refreshKey?: number;
  onSaved?: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function describeFrequency(rec: RecurringTransaction): string {
  if (rec.frequency === 'monthly') return `Todo dia ${rec.day_of_month ?? '?'}`;
  if (rec.frequency === 'weekly') return `Toda ${weekdays[rec.day_of_week ?? 0].toLowerCase()}`;
  if (rec.frequency === 'yearly') {
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `Todo ${rec.day_of_month ?? '?'} de ${months[(rec.month_of_year ?? 1) - 1]}`;
  }
  return rec.frequency;
}

function pickIcon(rec: RecurringTransaction): { name: string; tone: 'in' | 'out' | 'neutral' } {
  if (rec.type === 'income') return { name: 'arrow-down-right', tone: 'in' };
  if (rec.type === 'investment') return { name: 'trending-up', tone: 'in' };
  if (rec.category?.icon) return { name: rec.category.icon, tone: 'out' };
  return { name: 'arrow-up-right', tone: 'out' };
}

function monthlyAmount(rec: RecurringTransaction): number {
  const amt = Number(rec.amount);
  if (rec.frequency === 'monthly') return amt;
  if (rec.frequency === 'weekly') return amt * 4.345; // avg weeks/month
  if (rec.frequency === 'yearly') return amt / 12;
  return 0;
}

function nextLabel(rec: RecurringTransaction): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = nextOccurrence(rec, today);
  if (!next) return '—';
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff < 0) return `Atrasado ${Math.abs(diff)}d`;
  if (diff < 30) return `Em ${diff} dias`;
  return next.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

type FreqFilter = 'all' | RecurrenceFrequency;

export default function RecurringPage({ refreshKey = 0, onSaved }: Props) {
  const { data: items, loading, refresh } = useRecurring();
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [freqFilter, setFreqFilter] = useState<FreqFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!refreshKey) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((r) => {
      if (!showInactive && !r.is_active) return false;
      if (freqFilter !== 'all' && r.frequency !== freqFilter) return false;
      return true;
    });
  }, [items, freqFilter, showInactive]);

  const totals = useMemo(() => {
    const active = (items ?? []).filter((r) => r.is_active);
    let income = 0;
    let expense = 0;
    for (const r of active) {
      const m = monthlyAmount(r);
      if (r.type === 'income') income += m;
      else expense += m;
    }
    return { income, expense, net: income - expense, count: active.length };
  }, [items]);

  const handleMaterializeAll = async () => {
    if (!user) return;
    setMaterializing(true);
    try {
      const n = await materializeAllRecurring(user.id, 6);
      toast.success(`${n} ${n === 1 ? 'lançamento gerado' : 'lançamentos gerados'}`, 'Próximos 6 meses');
      onSaved?.();
    } catch (err: any) {
      toast.error('Erro ao gerar', err.message);
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="II — Movimentos"
        title={
          <>
            Despesas fixas e<br />
            <em>recorrências.</em>
          </>
        }
        note={
          <>
            saída fixa <strong className="text-red">−R$ {fmt(totals.expense)}/mês</strong> · entrada fixa{' '}
            <strong className="text-green">+R$ {fmt(totals.income)}/mês</strong> · líquido{' '}
            <strong className={totals.net >= 0 ? 'text-green' : 'text-red'}>
              {totals.net >= 0 ? '+' : '−'}R$ {fmt(Math.abs(totals.net))}
            </strong>
          </>
        }
        badges={
          <>
            <button
              className="tb-pill"
              onClick={handleMaterializeAll}
              disabled={materializing || !items?.some((r) => r.is_active)}
              style={{ opacity: materializing ? 0.6 : 1 }}
            >
              <Ti name="calendar-plus" />
              {materializing ? 'Gerando...' : 'Gerar próximos 6 meses'}
            </button>
            <button className="tb-btn" onClick={() => setCreating(true)}>
              <Ti name="plus" />
              Nova
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="inline-flex p-[3px] rounded-pill"
          style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
        >
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'monthly', label: 'Mensais' },
              { id: 'weekly', label: 'Semanais' },
              { id: 'yearly', label: 'Anuais' },
            ] as Array<{ id: FreqFilter; label: string }>
          ).map((f) => {
            const active = freqFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFreqFilter(f.id)}
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
        <label className="flex items-center gap-2 text-[11px] text-text-3 cursor-pointer ml-2">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativas
        </label>
      </div>

      {loading ? (
        <article className="g" style={{ padding: 18 }}>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={56} />
            ))}
          </div>
        </article>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={items && items.length > 0 ? 'Nada por aqui' : 'Sem despesas fixas ainda'}
          description={
            items && items.length > 0
              ? 'Tente outro filtro ou mostre as inativas.'
              : 'Cadastre aluguel, contas, assinaturas e seu salário pra projetar o fluxo dos próximos meses.'
          }
          cta={{ label: 'Nova recorrência', onClick: () => setCreating(true) }}
        />
      ) : (
        <article className="g" style={{ padding: '4px 20px 16px' }}>
          <div
            className="row-compact row-compact-header grid items-center gap-3 g-label"
            style={{
              gridTemplateColumns: '36px 1fr 110px 110px 130px 110px 50px',
              paddingTop: 14,
              paddingBottom: 10,
              borderBottom: '0.5px solid var(--border-lt)',
            }}
          >
            <span></span>
            <span>Recorrência</span>
            <span>Tipo</span>
            <span>Frequência</span>
            <span>Próximo</span>
            <span className="text-right">Valor</span>
            <span></span>
          </div>
          <ul>
            {filtered.map((r) => {
              const ico = pickIcon(r);
              const positive = r.type === 'income' || r.type === 'investment';
              return (
                <li
                  key={r.id}
                  onClick={() => setEditing(r)}
                  className="row-compact grid items-center gap-3 hover:bg-bg/60 transition-colors cursor-pointer"
                  style={{
                    gridTemplateColumns: '36px 1fr 110px 110px 130px 110px 50px',
                    padding: '12px 0',
                    borderBottom: '0.5px solid var(--border-lt)',
                    opacity: r.is_active ? 1 : 0.55,
                  }}
                >
                  <div className={`tx-ico ${ico.tone}`} style={{ width: 32, height: 32, fontSize: 14 }}>
                    <Ti name={ico.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="tx-name">{r.description}</div>
                    <div className="tx-cat">
                      {r.category?.name ?? 'Sem categoria'} · {r.account?.name ?? 'Sem conta'}
                    </div>
                  </div>
                  <div className="col-secondary">
                    <span className={typeChip[r.type]}>{typeLabel[r.type]}</span>
                  </div>
                  <div className="col-secondary text-[11.5px] text-text-2">{describeFrequency(r)}</div>
                  <div className="col-secondary text-[11.5px] text-text-2">
                    {r.is_active ? nextLabel(r) : <span className="text-text-4">Inativa</span>}
                  </div>
                  <div className={`text-right num-mono text-[12.5px] ${positive ? 'text-green' : 'text-red'}`}>
                    {positive ? '+' : '−'} {fmt(Math.abs(Number(r.amount)))}
                  </div>
                  <div className="col-secondary text-right">
                    <Ti name="chevron-right" size={14} className="text-text-4" />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      )}

      <RecurringModal
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        initial={editing}
        onSaved={() => {
          refresh();
          onSaved?.();
        }}
      />
    </div>
  );
}
