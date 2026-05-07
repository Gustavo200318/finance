import type { Category, Transaction, TransactionType } from './types';

export const CATEGORY_PALETTE = [
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
  '#EC4899', // pink
  '#8B5CF6', // violet light
];

export function colorForIndex(i: number, fallback?: string | null) {
  if (fallback) return fallback;
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
}

export function isRealized(t: Transaction): boolean {
  return t.status !== 'canceled' && t.status !== 'planned';
}

export interface CategoryAgg {
  id: string;
  name: string;
  color: string;
  total: number;
  pct: number;
  count: number;
}

export function aggregateByCategory(
  txs: Transaction[],
  type: TransactionType,
  categoriesById: Map<string, Category>,
  rollUpToParent: boolean = true
): CategoryAgg[] {
  const map = new Map<string, { name: string; total: number; color: string | null; count: number }>();

  for (const t of txs) {
    if (t.type !== type || !isRealized(t)) continue;
    const cat = t.category;
    let key: string;
    let name: string;
    let color: string | null;

    if (!cat) {
      key = '__none__';
      name = 'Sem categoria';
      color = '#9CA3AF';
    } else if (rollUpToParent && cat.parent_id) {
      const parent = categoriesById.get(cat.parent_id);
      if (parent) {
        key = parent.id;
        name = parent.name;
        color = parent.color ?? null;
      } else {
        key = cat.id;
        name = cat.name;
        color = cat.color ?? null;
      }
    } else {
      key = cat.id;
      name = cat.name;
      color = cat.color ?? null;
    }

    const cur = map.get(key) ?? { name, total: 0, color, count: 0 };
    cur.total += Number(t.amount);
    cur.count++;
    map.set(key, cur);
  }

  const all = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = all.reduce((s, [, v]) => s + v.total, 0);

  return all.map(([id, v], i) => ({
    id,
    name: v.name,
    color: colorForIndex(i, v.color),
    total: v.total,
    pct: grandTotal ? (v.total / grandTotal) * 100 : 0,
    count: v.count,
  }));
}

export interface MonthBucket {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
  debt: number;
  invest: number;
  net: number;
}

export function bucketByMonth(txs: Transaction[], months: { year: number; month: number }[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  for (const m of months) {
    const key = `${m.year}-${m.month}`;
    const label = new Date(m.year, m.month - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '');
    buckets.set(key, {
      year: m.year,
      month: m.month,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      income: 0,
      expense: 0,
      debt: 0,
      invest: 0,
      net: 0,
    });
  }

  for (const t of txs) {
    if (!isRealized(t)) continue;
    const [yStr, mStr] = t.transaction_date.split('-');
    const key = `${Number(yStr)}-${Number(mStr)}`;
    const b = buckets.get(key);
    if (!b) continue;
    const amt = Number(t.amount);
    if (t.type === 'income') b.income += amt;
    else if (t.type === 'expense') b.expense += amt;
    else if (t.type === 'debt_payment') b.debt += amt;
    else if (t.type === 'investment') b.invest += amt;
  }

  return Array.from(buckets.values())
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map((b) => ({ ...b, net: b.income - b.expense - b.debt - b.invest }));
}

export function lastNMonths(n: number, today = new Date()): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

export interface DateRange {
  from: string; // ISO yyyy-mm-dd
  to: string;
}

export function rangeForPeriod(period: string, today = new Date()): DateRange {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case '7d': {
      const f = new Date(start);
      f.setDate(f.getDate() - 6);
      return { from: iso(f), to: iso(start) };
    }
    case '30d': {
      const f = new Date(start);
      f.setDate(f.getDate() - 29);
      return { from: iso(f), to: iso(start) };
    }
    case '90d': {
      const f = new Date(start);
      f.setDate(f.getDate() - 89);
      return { from: iso(f), to: iso(start) };
    }
    case 'this_month': {
      const f = new Date(start.getFullYear(), start.getMonth(), 1);
      const t = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { from: iso(f), to: iso(t) };
    }
    case 'last_month': {
      const f = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const t = new Date(start.getFullYear(), start.getMonth(), 0);
      return { from: iso(f), to: iso(t) };
    }
    case 'this_year': {
      const f = new Date(start.getFullYear(), 0, 1);
      return { from: iso(f), to: iso(start) };
    }
    case '6m':
    default: {
      const f = new Date(start.getFullYear(), start.getMonth() - 5, 1);
      return { from: iso(f), to: iso(start) };
    }
  }
}
