import { z } from 'zod';

// Validações simples e robustas, sem depender de tipos enum complexos do Zod v4.
// Os enums vêm do TypeScript (lib/types.ts) — aqui validamos só strings/numbers/dates.

const positiveNumber = z
  .number()
  .finite('Valor inválido')
  .min(0, 'O valor não pode ser negativo');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)');

const optionalString = z.string().nullable().optional();

const TX_TYPES = ['income', 'expense', 'transfer', 'debt_payment', 'investment'] as const;
const TX_STATUS = ['paid', 'pending', 'planned', 'canceled'] as const;
const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit_card', 'investment', 'debt', 'other'] as const;
const REC_FREQ = ['monthly', 'weekly', 'yearly'] as const;
const CAT_TYPES = ['income', 'expense', 'debt', 'investment', 'transfer'] as const;

function inSet<T extends readonly string[]>(set: T, message: string) {
  return z.string().refine((v) => (set as readonly string[]).includes(v), { message });
}

// ─── Transaction ────────────────────────────────────────────────────────
export const transactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(120, 'Máximo 120 caracteres'),
  amount: positiveNumber,
  type: inSet(TX_TYPES, 'Tipo inválido'),
  transaction_date: isoDate,
  account_id: optionalString,
  category_id: optionalString,
  status: inSet(TX_STATUS, 'Status inválido'),
  notes: z.string().max(500, 'Máximo 500 caracteres').nullable().optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Account ────────────────────────────────────────────────────────────
export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60, 'Máximo 60 caracteres'),
  type: inSet(ACCOUNT_TYPES, 'Tipo de conta inválido'),
  institution: z.string().max(60).nullable().optional(),
  initial_balance: z.number().finite('Valor inválido'),
  is_active: z.boolean().optional(),
});

// ─── Recurring ──────────────────────────────────────────────────────────
export const recurringSchema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória').max(120),
  amount: positiveNumber,
  type: inSet(TX_TYPES, 'Tipo inválido'),
  frequency: inSet(REC_FREQ, 'Frequência inválida'),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  start_date: isoDate,
  end_date: isoDate.nullable().optional(),
});

// ─── Category ───────────────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60),
  type: inSet(CAT_TYPES, 'Tipo inválido'),
  parent_id: optionalString,
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Cor deve estar em formato hex (#FFAA22)')
    .nullable()
    .optional(),
  icon: z.string().max(40).nullable().optional(),
});

// Helper
export function firstError(error: z.ZodError, field: string): string | undefined {
  const issue = error.issues.find((i) => i.path[0] === field);
  return issue?.message;
}
