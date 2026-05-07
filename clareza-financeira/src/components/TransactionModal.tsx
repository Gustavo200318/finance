import React, { useEffect, useMemo, useState } from 'react';
import Ti from './Ti';
import Modal, { Field } from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './Toast';
import { useAccounts, useCategories, createTransaction, deleteTransaction, updateTransaction } from '../lib/data';
import { useAuth } from '../lib/auth';
import { transactionSchema } from '../lib/schemas';
import type { Transaction, TransactionStatus, TransactionType } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Transaction | null;
}

const tipos: { id: TransactionType; label: string }[] = [
  { id: 'income', label: 'Receita' },
  { id: 'expense', label: 'Despesa' },
  { id: 'transfer', label: 'Transf.' },
  { id: 'debt_payment', label: 'Dívida' },
  { id: 'investment', label: 'Invest.' },
];

const statusOptions: { id: TransactionStatus; label: string; hint: string }[] = [
  { id: 'paid', label: 'Pago', hint: 'Já saiu/entrou na conta' },
  { id: 'planned', label: 'Planejado', hint: 'Lançamento futuro previsto' },
  { id: 'pending', label: 'Pendente', hint: 'Esperando confirmação' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

type RepeatFreq = 'monthly' | 'weekly' | 'yearly';

const repeatFreqs: { id: RepeatFreq; label: string }[] = [
  { id: 'monthly', label: 'Mensal' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'yearly', label: 'Anual' },
];

function generateRepeatDates(startISO: string, count: number, freq: RepeatFreq): string[] {
  const out: string[] = [];
  const [y, m, d] = startISO.split('-').map(Number);
  const baseDay = d;
  for (let i = 0; i < count; i++) {
    let date: Date;
    if (freq === 'monthly') {
      date = new Date(y, m - 1 + i, 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(baseDay, lastDay));
    } else if (freq === 'weekly') {
      date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + i * 7);
    } else {
      date = new Date(y + i, m - 1, 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(baseDay, lastDay));
    }
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

const typeToCategoryFilter: Record<TransactionType, string[]> = {
  income: ['income'],
  expense: ['expense'],
  transfer: ['transfer'],
  debt_payment: ['debt', 'expense'],
  investment: ['investment'],
};

export default function TransactionModal({ open, onClose, onSaved, initial }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const editing = !!initial;

  const [form, setForm] = useState({
    desc: '',
    valor: '',
    tipo: 'expense' as TransactionType,
    conta: '',
    categoria: '',
    data: todayISO(),
    obs: '',
    status: 'paid' as TransactionStatus,
    statusTouched: false,
  });
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq>('monthly');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initial) {
      setForm({
        desc: initial.description,
        valor: String(initial.amount),
        tipo: initial.type,
        conta: initial.account_id ?? '',
        categoria: initial.category_id ?? '',
        data: initial.transaction_date,
        obs: initial.notes ?? '',
        status: initial.status,
        statusTouched: true,
      });
    } else {
      setForm((f) => ({
        ...f,
        desc: '',
        valor: '',
        tipo: 'expense',
        categoria: '',
        data: todayISO(),
        obs: '',
        status: 'paid',
        statusTouched: false,
      }));
      setRepeatCount(1);
      setRepeatFreq('monthly');
    }
  }, [open, initial]);

  // Auto-set status to planned when user picks a future date (until they touch status manually)
  useEffect(() => {
    if (!open || editing) return;
    setForm((f) => {
      if (f.statusTouched) return f;
      const isFuture = f.data > todayISO();
      const desired: TransactionStatus = isFuture ? 'planned' : 'paid';
      return f.status === desired ? f : { ...f, status: desired };
    });
  }, [form.data, open, editing]);

  // auto-pick first account when loaded
  useEffect(() => {
    if (!open || editing) return;
    if (!form.conta && accounts && accounts.length > 0) {
      setForm((f) => ({ ...f, conta: accounts[0].id }));
    }
  }, [accounts, form.conta, open, editing]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    const allowed = typeToCategoryFilter[form.tipo];
    return categories.filter((c) => allowed.includes(c.type));
  }, [categories, form.tipo]);

  useEffect(() => {
    if (!form.categoria) return;
    if (!filteredCategories.some((c) => c.id === form.categoria)) {
      setForm((f) => ({ ...f, categoria: filteredCategories[0]?.id ?? '' }));
    }
  }, [filteredCategories, form.categoria]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setStatus = (s: TransactionStatus) => setForm((f) => ({ ...f, status: s, statusTouched: true }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const rawPayload = {
        description: form.desc.trim(),
        amount: Number(form.valor),
        type: form.tipo,
        transaction_date: form.data,
        account_id: form.conta || null,
        category_id: form.categoria || null,
        notes: form.obs.trim() || null,
        status: form.status,
      };
      const parsed = transactionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        setErrorMsg(`${first.path.join('.')}: ${first.message}`);
        toast.error('Dados inválidos', first.message);
        setSaving(false);
        return;
      }
      const payload = {
        description: parsed.data.description,
        amount: parsed.data.amount,
        type: parsed.data.type as TransactionType,
        transaction_date: parsed.data.transaction_date,
        account_id: parsed.data.account_id || null,
        category_id: parsed.data.category_id || null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status as TransactionStatus,
      };
      if (editing && initial) {
        await updateTransaction(initial.id, payload);
        toast.success('Transação atualizada', payload.description);
      } else if (repeatCount > 1) {
        // Bulk create N occurrences
        const dates = generateRepeatDates(form.data, repeatCount, repeatFreq);
        const today = todayISO();
        let ok = 0;
        for (const d of dates) {
          // For occurrences in the future, force 'planned' even if user picked 'paid'
          const status: TransactionStatus =
            d > today && form.status === 'paid' ? 'planned' : form.status;
          await createTransaction(user.id, { ...payload, transaction_date: d, status });
          ok++;
        }
        toast.success(
          `${ok} lançamentos criados`,
          `${payload.description} · ${repeatFreq === 'monthly' ? 'mensal' : repeatFreq === 'weekly' ? 'semanal' : 'anual'}`
        );
      } else {
        await createTransaction(user.id, payload);
        toast.success('Transação criada', payload.description);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Erro ao salvar');
      toast.error('Erro ao salvar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      await deleteTransaction(initial.id);
      toast.success('Transação excluída');
      setConfirmDel(false);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Erro ao excluir');
      toast.error('Erro ao excluir', err.message);
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Editar transação' : 'Nova transação'}
        eyebrow="Lançamento"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
            <Field label="Descrição">
              <input
                type="text"
                value={form.desc}
                onChange={(e) => update('desc', e.target.value)}
                className="field-input"
                placeholder="Ex: Supermercado Pão de Açúcar"
                required
              />
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => update('valor', e.target.value)}
                className="field-input num-mono"
                style={{ fontSize: 16 }}
                placeholder="0,00"
                required
              />
            </Field>
          </div>

          <Field label="Tipo">
            <div
              className="inline-flex p-[3px] rounded-pill flex-wrap"
              style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
            >
              {tipos.map((t) => {
                const active = form.tipo === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => update('tipo', t.id)}
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
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Field label="Conta">
              <select value={form.conta} onChange={(e) => update('conta', e.target.value)} className="field-input">
                <option value="">— Sem conta —</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select
                value={form.categoria}
                onChange={(e) => update('categoria', e.target.value)}
                className="field-input"
              >
                <option value="">— Sem categoria —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={form.data}
                onChange={(e) => update('data', e.target.value)}
                className="field-input"
                required
              />
            </Field>
          </div>

          <Field
            label="Status"
            hint={statusOptions.find((s) => s.id === form.status)?.hint}
          >
            <div
              className="inline-flex p-[3px] rounded-pill flex-wrap"
              style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
            >
              {statusOptions.map((s) => {
                const active = form.status === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                    style={
                      active
                        ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                        : { color: 'var(--text-3)' }
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {!editing && (
            <Field
              label="Repetir"
              hint={
                repeatCount > 1
                  ? `Será criado ${repeatCount} ${repeatCount === 1 ? 'lançamento' : 'lançamentos'} ${
                      repeatFreq === 'monthly' ? 'mensais' : repeatFreq === 'weekly' ? 'semanais' : 'anuais'
                    }. Datas futuras vão como Planejado.`
                  : 'Marque mais de 1 vez para gerar repetições automáticas (despesa fixa, parcelas, salário…).'
              }
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="inline-flex p-[3px] rounded-pill flex-wrap"
                  style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
                >
                  {[1, 2, 3, 6, 12, 24].map((n) => {
                    const active = repeatCount === n;
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setRepeatCount(n)}
                        className="text-[11px] px-3 py-1 rounded-pill transition-colors"
                        style={
                          active
                            ? { background: 'var(--card)', color: 'var(--text-1)', fontWeight: 500 }
                            : { color: 'var(--text-3)' }
                        }
                      >
                        {n === 1 ? 'Não' : `${n}x`}
                      </button>
                    );
                  })}
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                    className="num-mono text-[11px] text-text-1 bg-transparent outline-none px-2"
                    style={{ width: 50, borderLeft: '0.5px solid var(--border-lt)' }}
                    title="Custom"
                  />
                </div>
                {repeatCount > 1 && (
                  <div
                    className="inline-flex p-[3px] rounded-pill"
                    style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
                  >
                    {repeatFreqs.map((f) => {
                      const active = repeatFreq === f.id;
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setRepeatFreq(f.id)}
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
                )}
              </div>
            </Field>
          )}

          <Field label="Observações">
            <textarea
              value={form.obs}
              onChange={(e) => update('obs', e.target.value)}
              className="field-input"
              style={{ minHeight: 70, resize: 'vertical' }}
              placeholder="Notas opcionais"
            />
          </Field>

          {errorMsg && (
            <div
              className="px-3 py-2 rounded-[10px] text-[11.5px]"
              style={{ background: 'var(--red-lt)', color: 'var(--red)' }}
            >
              {errorMsg}
            </div>
          )}

          <div
            className="flex items-center justify-end gap-2 pt-3"
            style={{ borderTop: '0.5px solid var(--border-lt)' }}
          >
            {editing && (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                className="text-[12px] text-red hover:text-red px-3 py-2 rounded-pill mr-auto"
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] text-text-3 hover:text-text-1 px-3 py-2 rounded-pill"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="tb-btn">
              <Ti name="check" />
              {saving
                ? 'Salvando...'
                : editing
                  ? 'Salvar'
                  : repeatCount > 1
                    ? `Criar ${repeatCount} lançamentos`
                    : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        title="Excluir transação?"
        description="Esta ação não pode ser desfeita. A transação será removida do extrato e da DRE."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
