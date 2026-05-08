-- Índices de performance — rode INTEIRO no SQL Editor do Supabase
-- Idempotente (CREATE INDEX IF NOT EXISTS).

-- ── Transactions ──────────────────────────────────────────────────────
-- Listagem do dashboard ordena por transaction_date DESC + filtra por user_id (RLS)
CREATE INDEX IF NOT EXISTS idx_tx_user_date
  ON public.transactions (user_id, transaction_date DESC);

-- Filtragem por mês/intervalo
CREATE INDEX IF NOT EXISTS idx_tx_user_date_status
  ON public.transactions (user_id, transaction_date DESC, status);

-- Joins com accounts/categories
CREATE INDEX IF NOT EXISTS idx_tx_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions (category_id);

-- View materializada/computed monthly_financial_statement geralmente filtra por (user_id, year, month)
CREATE INDEX IF NOT EXISTS idx_tx_user_type_date
  ON public.transactions (user_id, type, transaction_date DESC);

-- ── Accounts ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts (user_id);

-- ── Categories ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);

-- ── Debts ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_debts_user_priority
  ON public.debts (user_id, priority DESC, current_amount DESC);

-- ── Budgets ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_budgets_user_month
  ON public.budgets (user_id, year, month);

-- ── Goals ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON public.goals (user_id, status, created_at DESC);

-- ── Insights ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_insights_user_created
  ON public.financial_insights (user_id, created_at DESC);

-- ── Recurring ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recurring_user_active
  ON public.recurring_transactions (user_id, is_active);

-- Atualiza estatísticas pra o planner usar os índices imediatamente
ANALYZE public.transactions;
ANALYZE public.accounts;
ANALYZE public.categories;
ANALYZE public.debts;
ANALYZE public.budgets;
ANALYZE public.goals;
ANALYZE public.financial_insights;
ANALYZE public.recurring_transactions;
