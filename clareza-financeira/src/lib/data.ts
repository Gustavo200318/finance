import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type {
  Account,
  AccountType,
  Budget,
  Category,
  Debt,
  DebtStatus,
  Goal,
  GoalStatus,
  GoalType,
  Insight,
  MonthlyStatement,
  Profile,
  RecurrenceFrequency,
  RecurringTransaction,
  Transaction,
  TransactionStatus,
  TransactionType,
} from './types';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Wrapper sobre useQuery do TanStack Query.
 * Mantém a API antiga `{ data, loading, error, refresh }` pra não quebrar consumidores.
 *
 * Benefícios automáticos:
 * - Cache compartilhado entre componentes (mudar de tela e voltar é instantâneo)
 * - Dedup de requests idênticos
 * - Stale-while-revalidate (mostra cache + revalida em bg)
 * - GC automático após 5min sem uso
 */
function useAsync<T>(fn: () => Promise<T>, deps: any[]): QueryState<T> {
  // Timeout failsafe: query nunca demora mais de 8s
  const fnWithTimeout = () => {
    let timedOut = false;
    const timeoutP = new Promise<never>((_, reject) => {
      setTimeout(() => {
        timedOut = true;
        reject(new Error('Timeout: query demorou mais de 8s'));
      }, 8000);
    });
    return Promise.race([fn(), timeoutP]).then((r) => (timedOut ? (null as any) : (r as T)));
  };

  const q = useQuery<T, Error>({
    queryKey: ['async', ...deps],
    queryFn: fnWithTimeout,
  });

  const refresh = useCallback(async () => {
    await q.refetch();
  }, [q]);

  return {
    data: (q.data as T | null) ?? null,
    loading: q.isLoading,
    error: q.error ?? null,
    refresh,
  };
}

/** Invalida queries em massa após mutações (createTransaction, deleteAccount, etc) */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['async'] });
  }, [qc]);
}

const TX_SELECT =
  '*, account:accounts!transactions_account_id_fkey(id,name,type), category:categories(id,name,icon,color,type,parent_id)';

// ─── period helpers ────────────────────────────────────────────────────
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function currentMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// ─── Transactions ───────────────────────────────────────────────────────
export interface UseTransactionsOpts {
  limit?: number;
  type?: TransactionType;
  from?: string;
  to?: string;
  accountId?: string;
  status?: TransactionStatus | TransactionStatus[];
  excludeStatus?: TransactionStatus | TransactionStatus[];
  ascending?: boolean;
}

export function useTransactions(opts: UseTransactionsOpts = {}) {
  const { limit, type, from, to, accountId, status, excludeStatus, ascending } = opts;
  const statusKey = Array.isArray(status) ? status.join(',') : status;
  const excludeKey = Array.isArray(excludeStatus) ? excludeStatus.join(',') : excludeStatus;
  return useAsync<Transaction[]>(async () => {
    let q = supabase
      .from('transactions')
      .select(TX_SELECT)
      .order('transaction_date', { ascending: ascending ?? false })
      .order('created_at', { ascending: ascending ?? false });
    if (status) {
      if (Array.isArray(status)) q = q.in('status', status);
      else q = q.eq('status', status);
    } else if (excludeStatus) {
      if (Array.isArray(excludeStatus)) {
        for (const s of excludeStatus) q = q.neq('status', s);
      } else {
        q = q.neq('status', excludeStatus);
      }
    } else {
      q = q.neq('status', 'canceled');
    }
    if (limit) q = q.limit(limit);
    if (type) q = q.eq('type', type);
    if (from) q = q.gte('transaction_date', from);
    if (to) q = q.lte('transaction_date', to);
    if (accountId) q = q.eq('account_id', accountId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Transaction[];
  }, [limit, type, from, to, accountId, statusKey, excludeKey, ascending]);
}

export interface TransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  transaction_date: string;
  account_id: string | null;
  category_id: string | null;
  status?: TransactionStatus;
  notes?: string | null;
  recurring_id?: string | null;
}

export async function createTransaction(userId: string, input: TransactionInput) {
  const payload = {
    user_id: userId,
    description: input.description,
    amount: input.amount,
    type: input.type,
    transaction_date: input.transaction_date,
    account_id: input.account_id,
    category_id: input.category_id,
    status: input.status ?? 'paid',
    source: 'manual' as const,
    notes: input.notes ?? null,
    recurring_id: input.recurring_id ?? null,
  };
  const { data, error } = await supabase.from('transactions').insert(payload).select(TX_SELECT).maybeSingle();
  if (error) throw error;
  return data as unknown as Transaction;
}

export async function markTransactionPaid(id: string, paidDate?: string) {
  const update: Partial<TransactionInput> & { status: TransactionStatus } = {
    status: 'paid',
  };
  if (paidDate) update.transaction_date = paidDate;
  const { data, error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', id)
    .select(TX_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Transaction;
}

export async function updateTransaction(id: string, input: Partial<TransactionInput>) {
  const { data, error } = await supabase
    .from('transactions')
    .update(input)
    .eq('id', id)
    .select(TX_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Transaction;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Accounts ───────────────────────────────────────────────────────────
export function useAccounts() {
  return useAsync<Account[]>(async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Account[];
  }, []);
}

export interface AccountInput {
  name: string;
  type: AccountType;
  institution?: string | null;
  initial_balance?: number;
  is_active?: boolean;
}

export async function createAccount(userId: string, input: AccountInput) {
  const payload = {
    user_id: userId,
    name: input.name,
    type: input.type,
    institution: input.institution ?? null,
    initial_balance: input.initial_balance ?? 0,
    current_balance: input.initial_balance ?? 0,
    is_active: input.is_active ?? true,
  };
  const { data, error } = await supabase.from('accounts').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, input: Partial<AccountInput>) {
  const { data, error } = await supabase.from('accounts').update(input).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
}

// ─── Categories ─────────────────────────────────────────────────────────
export function useCategories() {
  return useAsync<Category[]>(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Category[];
  }, []);
}

export interface CategoryInput {
  name: string;
  type: Category['type'];
  parent_id?: string | null;
  color?: string | null;
  icon?: string | null;
}

export async function createCategory(userId: string, input: CategoryInput) {
  const payload = {
    user_id: userId,
    name: input.name,
    type: input.type,
    parent_id: input.parent_id ?? null,
    color: input.color ?? null,
    icon: input.icon ?? null,
    is_default: false,
  };
  const { data, error } = await supabase.from('categories').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Debts ──────────────────────────────────────────────────────────────
export function useDebts() {
  return useAsync<Debt[]>(async () => {
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .order('priority', { ascending: false })
      .order('current_amount', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Debt[];
  }, []);
}

export interface DebtInput {
  creditor_name: string;
  original_amount: number;
  current_amount: number;
  interest_rate?: number | null;
  due_date?: string | null;
  status?: DebtStatus;
  renegotiation_available?: boolean;
  priority?: number;
  notes?: string | null;
}

export async function createDebt(userId: string, input: DebtInput) {
  const payload = {
    user_id: userId,
    creditor_name: input.creditor_name,
    original_amount: input.original_amount,
    current_amount: input.current_amount,
    interest_rate: input.interest_rate ?? null,
    due_date: input.due_date ?? null,
    status: input.status ?? 'open',
    renegotiation_available: input.renegotiation_available ?? false,
    priority: input.priority ?? 1,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from('debts').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(id: string, input: Partial<DebtInput>) {
  const { data, error } = await supabase.from('debts').update(input).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data as Debt;
}

export async function deleteDebt(id: string) {
  const { error } = await supabase.from('debts').delete().eq('id', id);
  if (error) throw error;
}

// ─── Debt payments ──────────────────────────────────────────────────────
export interface DebtPaymentInput {
  debt_id: string;
  amount: number;
  payment_date: string;
  notes?: string | null;
  transaction_id?: string | null;
}

export async function createDebtPayment(userId: string, input: DebtPaymentInput) {
  const payload = {
    user_id: userId,
    debt_id: input.debt_id,
    amount: input.amount,
    payment_date: input.payment_date,
    notes: input.notes ?? null,
    transaction_id: input.transaction_id ?? null,
  };
  const { data, error } = await supabase.from('debt_payments').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Budgets ────────────────────────────────────────────────────────────
export function useBudgets(year: number, month: number) {
  return useAsync<Budget[]>(async () => {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(id,name,icon,color)')
      .eq('year', year)
      .eq('month', month);
    if (error) throw error;
    return (data ?? []) as unknown as Budget[];
  }, [year, month]);
}

export interface BudgetInput {
  category_id: string;
  month: number;
  year: number;
  planned_amount: number;
}

export async function upsertBudget(userId: string, input: BudgetInput) {
  const payload = {
    user_id: userId,
    category_id: input.category_id,
    month: input.month,
    year: input.year,
    planned_amount: input.planned_amount,
  };
  const { data, error } = await supabase
    .from('budgets')
    .upsert(payload, { onConflict: 'user_id,category_id,month,year' })
    .select('*, category:categories(id,name,icon,color)')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Budget;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

// ─── Goals ──────────────────────────────────────────────────────────────
export function useGoals() {
  return useAsync<Goal[]>(async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Goal[];
  }, []);
}

export interface GoalInput {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  type?: GoalType;
  status?: GoalStatus;
}

export async function createGoal(userId: string, input: GoalInput) {
  const payload = {
    user_id: userId,
    name: input.name,
    target_amount: input.target_amount,
    current_amount: input.current_amount,
    deadline: input.deadline ?? null,
    type: input.type ?? 'custom',
    status: input.status ?? 'active',
  };
  const { data, error } = await supabase.from('goals').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, input: Partial<GoalInput>) {
  const { data, error } = await supabase.from('goals').update(input).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

// ─── Insights ───────────────────────────────────────────────────────────
export function useInsights() {
  return useAsync<Insight[]>(async () => {
    const { data, error } = await supabase
      .from('financial_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as Insight[];
  }, []);
}

export async function markInsightRead(id: string, isRead = true) {
  const { error } = await supabase.from('financial_insights').update({ is_read: isRead }).eq('id', id);
  if (error) throw error;
}

// ─── Profile ────────────────────────────────────────────────────────────
export interface ProfileInput {
  name?: string | null;
  currency?: string;
  monthly_income_goal?: number;
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Profile;
}

// ─── Recurring transactions ─────────────────────────────────────────────
const REC_SELECT =
  '*, account:accounts(id,name,type), category:categories(id,name,icon,color,type)';

export function useRecurring(opts: { activeOnly?: boolean } = {}) {
  const { activeOnly } = opts;
  return useAsync<RecurringTransaction[]>(async () => {
    let q = supabase
      .from('recurring_transactions')
      .select(REC_SELECT)
      .order('is_active', { ascending: false })
      .order('description', { ascending: true });
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as RecurringTransaction[];
  }, [activeOnly]);
}

export interface RecurringInput {
  description: string;
  amount: number;
  type: TransactionType;
  account_id: string | null;
  category_id: string | null;
  frequency: RecurrenceFrequency;
  day_of_month?: number | null;
  day_of_week?: number | null;
  month_of_year?: number | null;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export async function createRecurring(userId: string, input: RecurringInput) {
  const payload = {
    user_id: userId,
    description: input.description,
    amount: input.amount,
    type: input.type,
    account_id: input.account_id,
    category_id: input.category_id,
    frequency: input.frequency,
    day_of_month: input.day_of_month ?? null,
    day_of_week: input.day_of_week ?? null,
    month_of_year: input.month_of_year ?? null,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_active: input.is_active ?? true,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert(payload)
    .select(REC_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as RecurringTransaction;
}

export async function updateRecurring(id: string, input: Partial<RecurringInput>) {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(input)
    .eq('id', id)
    .select(REC_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as RecurringTransaction;
}

export async function deleteRecurring(id: string, opts: { deletePlanned?: boolean } = {}) {
  if (opts.deletePlanned) {
    const { error: txErr } = await supabase
      .from('transactions')
      .delete()
      .eq('recurring_id', id)
      .eq('status', 'planned');
    if (txErr) throw txErr;
  }
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) throw error;
}

// Compute the next occurrence date >= `from` for a given recurring rule.
export function nextOccurrence(rec: RecurringTransaction, from: Date): Date | null {
  const start = new Date(rec.start_date + 'T00:00:00');
  const end = rec.end_date ? new Date(rec.end_date + 'T00:00:00') : null;
  const cursor = from < start ? new Date(start) : new Date(from);
  cursor.setHours(0, 0, 0, 0);

  const advance = (): Date | null => {
    if (rec.frequency === 'monthly') {
      const dom = rec.day_of_month ?? start.getDate();
      const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dom);
      if (candidate < cursor) candidate.setMonth(candidate.getMonth() + 1);
      // clamp to last day of month if dom > days in month
      while (candidate.getDate() !== Math.min(dom, daysInMonth(candidate.getFullYear(), candidate.getMonth() + 1))) {
        candidate.setDate(0); // last day of previous month — won't trigger; safety
        break;
      }
      return candidate;
    }
    if (rec.frequency === 'weekly') {
      const dow = rec.day_of_week ?? start.getDay();
      const candidate = new Date(cursor);
      const diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      return candidate;
    }
    if (rec.frequency === 'yearly') {
      const dom = rec.day_of_month ?? start.getDate();
      const moy = (rec.month_of_year ?? start.getMonth() + 1) - 1;
      const candidate = new Date(cursor.getFullYear(), moy, dom);
      if (candidate < cursor) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
    return null;
  };

  const next = advance();
  if (!next) return null;
  if (end && next > end) return null;
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function addOne(date: Date, freq: RecurrenceFrequency): Date {
  const d = new Date(date);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Project all upcoming occurrences within [from, to] for a single rule.
export function expandRecurring(rec: RecurringTransaction, from: Date, to: Date): string[] {
  if (!rec.is_active) return [];
  const out: string[] = [];
  let cursor = nextOccurrence(rec, from);
  let safety = 0;
  while (cursor && cursor <= to && safety < 365) {
    out.push(toISODate(cursor));
    cursor = nextOccurrence(rec, addOne(cursor, rec.frequency));
    safety++;
  }
  return out;
}

// Materialize upcoming occurrences as transactions with status='planned'.
// Idempotent: skips dates that already have a transaction linked to this recurring rule.
export async function materializeRecurring(
  userId: string,
  rec: RecurringTransaction,
  monthsAhead = 6
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + monthsAhead);

  const dates = expandRecurring(rec, today, horizon);
  if (dates.length === 0) return 0;

  const { data: existing, error: exErr } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('recurring_id', rec.id)
    .in('transaction_date', dates);
  if (exErr) throw exErr;
  const existingSet = new Set((existing ?? []).map((r: any) => r.transaction_date));

  const toInsert = dates
    .filter((d) => !existingSet.has(d))
    .map((d) => ({
      user_id: userId,
      description: rec.description,
      amount: rec.amount,
      type: rec.type,
      transaction_date: d,
      account_id: rec.account_id,
      category_id: rec.category_id,
      status: 'planned' as const,
      source: 'manual' as const,
      notes: rec.notes,
      recurring_id: rec.id,
    }));

  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('transactions').insert(toInsert);
  if (error) throw error;
  return toInsert.length;
}

export async function materializeAllRecurring(userId: string, monthsAhead = 6): Promise<number> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(REC_SELECT)
    .eq('is_active', true);
  if (error) throw error;
  let total = 0;
  for (const rec of (data ?? []) as unknown as RecurringTransaction[]) {
    total += await materializeRecurring(userId, rec, monthsAhead);
  }
  return total;
}

// ─── DRE / Monthly statement ────────────────────────────────────────────
export function useMonthlyStatement(year: number, month: number) {
  return useAsync<MonthlyStatement | null>(async () => {
    const { data, error } = await supabase
      .from('monthly_financial_statement')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (error) throw error;
    return (data as MonthlyStatement) ?? null;
  }, [year, month]);
}

export function useMonthTransactions(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return useTransactions({ from: start, to: end });
}

// ─── Aggregates / helpers ───────────────────────────────────────────────
function isRealized(t: Transaction): boolean {
  return t.status !== 'canceled' && t.status !== 'planned';
}

export function sumByType(txs: Transaction[], type: TransactionType): number {
  return txs.filter((t) => t.type === type && isRealized(t)).reduce((s, t) => s + Number(t.amount), 0);
}

export function sumByCategory(txs: Transaction[]): Map<string, { name: string; total: number; color: string | null }> {
  const map = new Map<string, { name: string; total: number; color: string | null }>();
  for (const t of txs) {
    if (t.type !== 'expense' || !isRealized(t)) continue;
    const key = t.category?.id ?? '__none__';
    const name = t.category?.name ?? 'Sem categoria';
    const color = t.category?.color ?? null;
    const cur = map.get(key) ?? { name, total: 0, color };
    cur.total += Number(t.amount);
    map.set(key, cur);
  }
  return map;
}

export function accountBalanceFromTx(account: Account, txs: Transaction[]): number {
  let bal = Number(account.initial_balance);
  for (const t of txs) {
    if (t.account_id !== account.id || !isRealized(t)) continue;
    const amt = Number(t.amount);
    if (t.type === 'income') bal += amt;
    else if (t.type === 'expense' || t.type === 'debt_payment' || t.type === 'investment') bal -= amt;
    else if (t.type === 'transfer') bal -= amt;
  }
  return bal;
}

export function applyTxToBalance(bal: number, t: Transaction): number {
  if (t.type === 'income') return bal + Number(t.amount);
  if (t.type === 'transfer') return bal - Number(t.amount);
  return bal - Number(t.amount); // expense, debt_payment, investment
}
