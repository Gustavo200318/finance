export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'investment' | 'debt' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'debt_payment' | 'investment';
export type TransactionStatus = 'paid' | 'pending' | 'planned' | 'canceled';
export type TransactionSource = 'manual' | 'csv' | 'bank_import' | 'ai_generated';
export type CategoryType = 'income' | 'expense' | 'debt' | 'investment' | 'transfer';
export type DebtStatus = 'open' | 'renegotiated' | 'paid' | 'overdue' | 'defaulted';
export type GoalType = 'emergency_fund' | 'debt_free' | 'investment' | 'purchase' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'canceled';
export type InsightSeverity = 'info' | 'success' | 'warning' | 'danger';
export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly';

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  currency: string;
  monthly_income_goal: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  import_batch_id: string | null;
  recurring_id: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  transaction_date: string;
  payment_method: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: Pick<Account, 'id' | 'name' | 'type'> | null;
  category?:
    | (Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type' | 'parent_id'> & {
        parent?: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
      })
    | null;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  account_id: string | null;
  category_id: string | null;
  frequency: RecurrenceFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  month_of_year: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: Pick<Account, 'id' | 'name' | 'type'> | null;
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'> | null;
}

export interface Debt {
  id: string;
  user_id: string;
  creditor_name: string;
  original_amount: number;
  current_amount: number;
  interest_rate: number | null;
  due_date: string | null;
  status: DebtStatus;
  renegotiation_available: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  month: number;
  year: number;
  planned_amount: number;
  actual_amount: number;
  created_at: string;
  updated_at: string;
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  type: GoalType;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface Insight {
  id: string;
  user_id: string;
  category_id: string | null;
  transaction_id: string | null;
  type: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  is_read: boolean;
  created_at: string;
}

export interface MonthlyStatement {
  user_id: string;
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  total_debt_payments: number;
  total_investments: number;
  net_result: number;
}
