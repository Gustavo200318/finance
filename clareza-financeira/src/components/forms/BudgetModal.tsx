import React, { useEffect, useMemo, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import { deleteBudget, upsertBudget, useCategories } from '../../lib/data';
import type { Budget } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Budget | null;
  defaultMonth: number;
  defaultYear: number;
}

export default function BudgetModal({ open, onClose, onSaved, initial, defaultMonth, defaultYear }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: categories } = useCategories();
  const editing = !!initial;
  const [form, setForm] = useState({
    category_id: '',
    planned_amount: '',
    month: defaultMonth,
    year: defaultYear,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === 'expense'),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initial) {
      setForm({
        category_id: initial.category_id ?? '',
        planned_amount: String(initial.planned_amount ?? ''),
        month: initial.month,
        year: initial.year,
      });
    } else {
      setForm({
        category_id: expenseCategories[0]?.id ?? '',
        planned_amount: '',
        month: defaultMonth,
        year: defaultYear,
      });
    }
  }, [open, initial, defaultMonth, defaultYear, expenseCategories]);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.category_id) {
      setErrorMsg('Escolha uma categoria');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const cat = categories?.find((c) => c.id === form.category_id);
      await upsertBudget(user.id, {
        category_id: form.category_id,
        month: Number(form.month),
        year: Number(form.year),
        planned_amount: Number(form.planned_amount) || 0,
      });
      toast.success(editing ? 'Orçamento atualizado' : 'Orçamento criado', cat?.name);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao salvar');
      toast.error('Erro ao salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      await deleteBudget(initial.id);
      toast.success('Orçamento excluído');
      setConfirmDel(false);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao excluir');
      toast.error('Erro ao excluir', e.message);
      setDeleting(false);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const years = [defaultYear - 1, defaultYear, defaultYear + 1];

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? 'Editar orçamento' : 'Novo orçamento'} eyebrow="Plano">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Categoria">
            <select
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
              className="field-input"
              disabled={editing}
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="Mês">
              <select value={form.month} onChange={(e) => update('month', Number(e.target.value))} className="field-input" disabled={editing}>
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ano">
              <select value={form.year} onChange={(e) => update('year', Number(e.target.value))} className="field-input" disabled={editing}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Planejado (R$)">
              <input
                type="number"
                step="0.01"
                value={form.planned_amount}
                onChange={(e) => update('planned_amount', e.target.value)}
                className="field-input num-mono"
                required
              />
            </Field>
          </div>

          <FormFooter
            saving={saving}
            saveLabel={editing ? 'Salvar' : 'Criar orçamento'}
            onCancel={onClose}
            errorMsg={errorMsg}
            destructive={editing ? { label: 'Excluir', onClick: () => setConfirmDel(true) } : undefined}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        title="Excluir orçamento?"
        description="Apenas o limite planejado será excluído. As transações ficam intactas."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
