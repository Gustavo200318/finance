// Lê import_data/nubank_raw.csv e gera supabase_import_nubank.sql
// Uso: node scripts/build-import-sql.js
const fs = require('fs');
const path = require('path');

const USER_EMAIL = 'gustavo.gabriel@55tech.com.br';

const csvPath = path.join(__dirname, '..', 'import_data', 'nubank_raw.csv');
const sqlOut = path.join(__dirname, '..', 'supabase_import_nubank.sql');

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(';');

const rows = lines.map((line) => {
  const cols = line.split(';');
  const o = {};
  header.forEach((h, i) => { o[h] = cols[i] ?? ''; });
  return o;
});

// Decide tipo de conta pelo nome
const accountType = (name) => {
  const n = name.toLowerCase();
  if (n.includes('cartão') || n.includes('cartao') || n.includes('credit')) return 'credit_card';
  if (n.includes('investiment')) return 'investment';
  if (n.includes('poupanc')) return 'savings';
  return 'checking';
};

// Decide tipo de categoria pelo nome
const categoryType = (name) => {
  const n = name.toLowerCase();
  if (n.includes('receita') || n.includes('entrada') || n.includes('salário') || n.includes('salario')) return 'income';
  if (n.includes('transfer') || n.includes('pix') || n.includes('pagamento de fatura')) return 'transfer';
  if (n.includes('investiment')) return 'investment';
  return 'expense';
};

const accounts = Array.from(new Set(rows.map(r => r.account_name)));
const categories = Array.from(new Set(rows.map(r => r.category_name)));

const esc = (s) => (s ?? '').replace(/'/g, "''");

let sql = `-- Import Nubank — gerado por scripts/build-import-sql.js
-- Rode INTEIRO no SQL Editor do Supabase.
-- Idempotente: criar contas/categorias se não existirem; transações inseridas em lote.

DO $$
DECLARE
  v_user uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = '${USER_EMAIL}' LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário com email ${USER_EMAIL} não encontrado em auth.users';
  END IF;

  -- ── Contas ─────────────────────────────────────────────────────────
`;

accounts.forEach((acc) => {
  sql += `  INSERT INTO public.accounts (user_id, name, type)
  SELECT v_user, '${esc(acc)}', '${accountType(acc)}'
  WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = v_user AND name = '${esc(acc)}');\n`;
});

sql += `
  -- ── Categorias ─────────────────────────────────────────────────────
`;

categories.forEach((cat) => {
  sql += `  INSERT INTO public.categories (user_id, name, type)
  SELECT v_user, '${esc(cat)}', '${categoryType(cat)}'
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = v_user AND name = '${esc(cat)}');\n`;
});

sql += `
  -- ── Transações ────────────────────────────────────────────────────
  INSERT INTO public.transactions (user_id, account_id, category_id, description, amount, type, transaction_date, status, source, notes)
  VALUES
`;

const valuesSql = rows.map((r, idx) => {
  const amount = Math.abs(parseFloat(r.amount));
  const status = r.status === 'review' ? 'pending' : (r.status || 'paid');
  const last = idx === rows.length - 1;
  return `    (
      v_user,
      (SELECT id FROM public.accounts WHERE user_id = v_user AND name = '${esc(r.account_name)}'),
      (SELECT id FROM public.categories WHERE user_id = v_user AND name = '${esc(r.category_name)}'),
      '${esc(r.description)}',
      ${amount.toFixed(2)},
      '${r.type}',
      '${r.transaction_date}',
      '${status}',
      '${r.source || 'csv'}',
      '${esc(r.notes)}'
    )${last ? ';' : ','}`;
}).join('\n');

sql += valuesSql + `

  RAISE NOTICE 'Import concluído. Total de transações inseridas: ${rows.length}';
END $$;
`;

fs.writeFileSync(sqlOut, sql, 'utf8');
console.log(`✔ SQL gerado: ${sqlOut}`);
console.log(`  Contas: ${accounts.length}`);
console.log(`  Categorias: ${categories.length}`);
console.log(`  Transações: ${rows.length}`);
