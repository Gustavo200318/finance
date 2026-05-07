-- ─────────────────────────────────────────────────────────────────────────────
-- Clareza Financeira — Schema completo
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- É idempotente (IF NOT EXISTS / OR REPLACE) — pode rodar de novo sem quebrar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Função utilitária: trigger updated_at ──────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ─── 1) PROFILES ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  currency text not null default 'BRL',
  monthly_income_goal numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user on public.profiles(user_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ─── 2) ACCOUNTS ────────────────────────────────────────────────────────────
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking','savings','cash','credit_card','investment','debt','other')),
  institution text,
  initial_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_user_active on public.accounts(user_id, is_active);

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

drop policy if exists "accounts_all_own" on public.accounts;
create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 3) CATEGORIES ──────────────────────────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense','debt','investment','transfer')),
  parent_id uuid references public.categories(id) on delete set null,
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_user_parent on public.categories(user_id, parent_id);
create index if not exists idx_categories_user_type on public.categories(user_id, type);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

-- Categorias podem ser globais (user_id null e is_default=true) ou pessoais
drop policy if exists "categories_select_own_or_default" on public.categories;
create policy "categories_select_own_or_default" on public.categories
  for select using (auth.uid() = user_id or (user_id is null and is_default = true));

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ─── 4) TRANSACTIONS ────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  import_batch_id uuid,
  recurring_id uuid,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  type text not null check (type in ('income','expense','transfer','debt_payment','investment')),
  transaction_date date not null,
  payment_method text,
  status text not null default 'paid' check (status in ('paid','pending','planned','canceled')),
  source text not null default 'manual' check (source in ('manual','csv','bank_import','ai_generated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tx_user_date_desc on public.transactions(user_id, transaction_date desc);
create index if not exists idx_tx_user_type_date on public.transactions(user_id, type, transaction_date desc);
create index if not exists idx_tx_user_account_date on public.transactions(user_id, account_id, transaction_date desc);
create index if not exists idx_tx_user_category on public.transactions(user_id, category_id);
create index if not exists idx_transactions_status_date on public.transactions(user_id, status, transaction_date);

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 5) DEBTS ───────────────────────────────────────────────────────────────
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor_name text not null,
  original_amount numeric(14,2) not null check (original_amount >= 0),
  current_amount numeric(14,2) not null check (current_amount >= 0),
  interest_rate numeric(7,4),
  due_date date,
  status text not null default 'open' check (status in ('open','renegotiated','paid','overdue','defaulted')),
  renegotiation_available boolean not null default false,
  priority int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_debts_user_status on public.debts(user_id, status);

drop trigger if exists trg_debts_updated_at on public.debts;
create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

drop policy if exists "debts_all_own" on public.debts;
create policy "debts_all_own" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 6) DEBT PAYMENTS ───────────────────────────────────────────────────────
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  notes text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_user on public.debt_payments(user_id);
create index if not exists idx_debt_payments_debt on public.debt_payments(debt_id);

alter table public.debt_payments enable row level security;

drop policy if exists "debt_payments_all_own" on public.debt_payments;
create policy "debt_payments_all_own" on public.debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 7) BUDGETS ─────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  planned_amount numeric(14,2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(14,2) not null default 0 check (actual_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, year, month)
);

create index if not exists idx_budgets_user_period on public.budgets(user_id, year, month);

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 8) GOALS ───────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount >= 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  deadline date,
  type text not null check (type in ('emergency_fund','debt_free','investment','purchase','custom')),
  status text not null default 'active' check (status in ('active','completed','paused','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goals_user_status on public.goals(user_id, status);

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

drop policy if exists "goals_all_own" on public.goals;
create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 9) FINANCIAL INSIGHTS ──────────────────────────────────────────────────
create table if not exists public.financial_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  type text not null,
  title text not null,
  description text not null,
  severity text not null check (severity in ('info','success','warning','danger')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_insights_user_created on public.financial_insights(user_id, created_at desc);

alter table public.financial_insights enable row level security;

drop policy if exists "insights_all_own" on public.financial_insights;
create policy "insights_all_own" on public.financial_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 10) RECURRING TRANSACTIONS ────────────────────────────────────────────
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  type text not null check (type in ('income','expense','transfer','debt_payment','investment')),
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  frequency text not null check (frequency in ('monthly','weekly','yearly')),
  day_of_month int check (day_of_month between 1 and 31),
  day_of_week int check (day_of_week between 0 and 6),
  month_of_year int check (month_of_year between 1 and 12),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_user on public.recurring_transactions(user_id);
create index if not exists idx_recurring_active on public.recurring_transactions(user_id, is_active);

drop trigger if exists trg_recurring_updated_at on public.recurring_transactions;
create trigger trg_recurring_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

-- Garante que colunas opcionais existam mesmo em tabelas pré-existentes
-- (CREATE TABLE IF NOT EXISTS não adiciona colunas em tabelas já criadas).
alter table public.transactions add column if not exists recurring_id uuid;
alter table public.transactions add column if not exists import_batch_id uuid;

-- FK do recurring_id na transactions (depois que a tabela existe)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_recurring_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_recurring_id_fkey
      foreign key (recurring_id) references public.recurring_transactions(id) on delete set null;
  end if;
end $$;

create index if not exists idx_transactions_recurring on public.transactions(recurring_id);

alter table public.recurring_transactions enable row level security;

drop policy if exists "recurring_all_own" on public.recurring_transactions;
create policy "recurring_all_own" on public.recurring_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 11) VIEW: monthly_financial_statement ─────────────────────────────────
-- Agrega receitas, despesas, dívidas pagas e investimentos por mês.
-- Considera apenas transações realizadas (status != 'planned' e != 'canceled').
create or replace view public.monthly_financial_statement
with (security_invoker = true) as
select
  t.user_id,
  extract(year from t.transaction_date)::int as year,
  extract(month from t.transaction_date)::int as month,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as total_income,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as total_expenses,
  coalesce(sum(t.amount) filter (where t.type = 'debt_payment'), 0) as total_debt_payments,
  coalesce(sum(t.amount) filter (where t.type = 'investment'), 0) as total_investments,
  (
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'debt_payment'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'investment'), 0)
  ) as net_result
from public.transactions t
where t.status not in ('planned', 'canceled')
group by t.user_id, year, month;

-- ─── 12) Trigger opcional: cria profile automaticamente no signup ──────────
-- Útil de redundância: o app já tenta criar via ensureProfile() mas isto
-- garante que mesmo usuários criados via Supabase Studio tenham profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Fim ────────────────────────────────────────────────────────────────────
-- Tudo certo. O app deve agora funcionar em http://localhost:3000.
