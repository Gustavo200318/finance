-- ─────────────────────────────────────────────────────────────────────────────
-- Clareza Financeira — Extras
-- Recorrências (despesas/receitas fixas) + vínculo opcional com transações.
-- Rode este arquivo inteiro no SQL editor do Supabase. É idempotente
-- (usa IF NOT EXISTS / OR REPLACE) — pode rodar de novo sem quebrar.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Vínculo opcional: transação gerada por uma recorrência
alter table public.transactions
  add column if not exists recurring_id uuid;

-- 2) Tabela de recorrências
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

-- 3) FK do vínculo (depois que a tabela já existe)
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
create index if not exists idx_transactions_status_date on public.transactions(user_id, status, transaction_date);

-- Performance indexes (queries do app)
create index if not exists idx_tx_user_date_desc
  on public.transactions(user_id, transaction_date desc);

create index if not exists idx_tx_user_type_date
  on public.transactions(user_id, type, transaction_date desc);

create index if not exists idx_tx_user_account_date
  on public.transactions(user_id, account_id, transaction_date desc);

create index if not exists idx_tx_user_category
  on public.transactions(user_id, category_id);

create index if not exists idx_categories_user_parent
  on public.categories(user_id, parent_id);

create index if not exists idx_categories_user_type
  on public.categories(user_id, type);

create index if not exists idx_accounts_user_active
  on public.accounts(user_id, is_active);

create index if not exists idx_debts_user_status
  on public.debts(user_id, status);

create index if not exists idx_goals_user_status
  on public.goals(user_id, status);

create index if not exists idx_budgets_user_period
  on public.budgets(user_id, year, month);

-- 4) updated_at trigger (reaproveita função já existente se houver)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $f$
    begin
      new.updated_at = now();
      return new;
    end
    $f$;
  end if;
end $$;

drop trigger if exists trg_recurring_updated_at on public.recurring_transactions;
create trigger trg_recurring_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

-- 5) RLS
alter table public.recurring_transactions enable row level security;

drop policy if exists "recurring_select_own" on public.recurring_transactions;
create policy "recurring_select_own" on public.recurring_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "recurring_insert_own" on public.recurring_transactions;
create policy "recurring_insert_own" on public.recurring_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "recurring_update_own" on public.recurring_transactions;
create policy "recurring_update_own" on public.recurring_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurring_delete_own" on public.recurring_transactions;
create policy "recurring_delete_own" on public.recurring_transactions
  for delete using (auth.uid() = user_id);
