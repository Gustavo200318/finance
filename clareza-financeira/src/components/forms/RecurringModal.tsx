import React, { useEffect, useMemo, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import {
  createRecurring,
  deleteRecurring,
  materializeRecurring,
  updateRecurring,
  useAccounts,
  useCategories,
} from '../../lib/data';
import type { RecurrenceFrequency, RecurringTransaction, TransactionType } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: RecurringTransaction | null;
}

const tipos: { id: TransactionType; label: string }[] = [
  { id: 'expense', label: 'Despesa' },
  { id: 'income', label: 'Receita' },
  { id: 'debt_payment', label: 'Dívida' },
  { id: 'investment', label: 'Invest.' },
];

const freqs: { id: RecurrenceFrequency; label: string; hint: string }[] = [
  { id: 'monthly', label: 'Mensal', hint: 'Toda mês no dia escolhido' },
  { id: 'weekly', label: 'Semanal', hint: 'Toda semana no dia escolhido' },
  { id: 'yearly', label: 'Anual', hint: 'Uma vez por ano' },
];

const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const typeToCategoryFilter: Record<TransactionType, string[]> = {
  income: ['income'],
  expense: ['expense'],
  transfer: ['transfer'],
  debt_payment: ['debt', 'expense'],
  investment: ['investment'],
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function RecurringModal({ open, onClose, onSaved, initial }: Props) {
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
    frequency: 'monthly' as RecurrenceFrequency,
    dayOfMonth: String(new Date().getDate()),
    dayOfWeek: '1',
    monthOfYear: String(new Date().getMonth() + 1),
    startDate: todayISO(),
    endDate: '',
    isActive: true,
    obs: '',
  });
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
        frequency: initial.frequency,
        dayOfMonth: String(initial.day_of_month ?? new Date().getDate()),
        dayOfWeek: String(initial.day_of_week ?? 1),
        monthOfYear: String(initial.month_of_year ?? new Date().getMonth() + 1),
        startDate: initial.start_date,
        endDate: initial.end_date ?? '',
        isActive: initial.is_active,
        obs: initial.notes ?? '',
      });
    } else {
      setForm({
        desc: '',
        valor: '',
        tipo: 'expense',
        conta: '',
        categoria: '',
        frequency: 'monthly',
        dayOfMonth: String(new Date().getDate()),
        dayOfWeek: '1',
        monthOfYear: String(new Date().getMonth() + 1),
        startDate: todayISO(),
        endDate: '',
        isActive: true,
        obs: '',
      });
    }
  }, [open, initial]);

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

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.desc || !form.valor) {
      setErrorMsg('Preencha descrição e valor');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        description: form.desc.trim(),
        amount: Number(form.valor),
        type: form.tipo,
        account_id: form.conta || null,
        category_id: form.categoria || null,
        frequency: form.frequency,
        day_of_month: form.frequency !== 'weekly' ? Number(form.dayOfMonth) : null,
        day_of_week: form.frequency === 'weekly' ? Number(form.dayOfWeek) : null,
        month_of_year: form.frequency === 'yearly' ? Number(form.monthOfYear) : null,
        start_date: form.startDate,
        end_date: form.endDate || null,
        is_active: form.isActive,
        notes: form.obs.trim() || null,
      };
      let saved: RecurringTransaction;
      if (editing && initial) {
        saved = await updateRecurring(initial.id, payload);
        toast.success('Recorrência atualizada', payload.description);
      } else {
        saved = await createRecurring(user.id, payload);
        toast.success('Recorrência criada', payload.description);
      }
      // Materialize next 6 months automatically
      if (saved && saved.is_active) {
        try {
          const n = await materializeRecurring(user.id, saved, 6);
          if (n > 0) toast.info(`${n} ${n === 1 ? 'lançamento gerado' : 'lançamentos gerados'}`, 'Próximos 6 meses');
        } catch (mErr: any) {
          console.warn('Falha ao materializar:', mErr);
        }
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
      await deleteRecurring(initial.id, { deletePlanned: true });
      toast.success('Recorrência excluída', 'Lançamentos planejados também foram removidos');
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
        title={editing ? 'Editar recorrência' : 'Nova recorrência'}
        eyebrow="Despesa fixa"
        width={600}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
            <Field label="Descrição">
              <input
                type="text"
                value={form.desc}
                onChange={(e) => update('desc', e.target.value)}
                className="field-input"
                placeholder="Ex: Aluguel, Netflix, Salário"
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

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
          </div>

          <Field label="Frequência" hint={freqs.find((f) => f.id === form.frequency)?.hint}>
            <div
              className="inline-flex p-[3px] rounded-pill"
              style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}
            >
              {freqs.map((f) => {
                const active = form.frequency === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => update('frequency', f.id)}
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
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {form.frequency === 'monthly' && (
              <Field label="Dia do mês">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) => update('dayOfMonth', e.target.value)}
                  className="field-input num-mono"
                />
              </Field>
            )}
            {form.frequency === 'weekly' && (
              <Field label="Dia da semana">
                <select value={form.dayOfWeek} onChange={(e) => update('dayOfWeek', e.target.value)} className="field-input">
                  {weekdays.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {form.frequency === 'yearly' && (
              <>
                <Field label="Dia">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={(e) => update('dayOfMonth', e.target.value)}
                    className="field-input num-mono"
                  />
                </Field>
                <Field label="Mês">
                  <select
                    value={form.monthOfYear}
                    onChange={(e) => update('monthOfYear', e.target.value)}
                    className="field-input"
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Início">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className="field-input"
                required
              />
            </Field>
            <Field label="Fim (opcional)" hint="Deixe em branco para sem fim">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                className="field-input"
              />
            </Field>
          </div>

          <Field label="Status">
            <label className="flex items-center gap-2 text-[12px] text-text-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
              />
              Ativa — gera lançamentos planejados automaticamente
            </label>
          </Field>

          <Field label="Observações">
            <textarea
              value={form.obs}
              onChange={(e) => update('obs', e.target.value)}
              className="field-input"
              style={{ minHeight: 60, resize: 'vertical' }}
              placeholder="Notas opcionais"
            />
          </Field>

          <FormFooter
            saving={saving}
            saveLabel={editing ? 'Salvar' : 'Criar recorrência'}
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
        title="Excluir recorrência?"
        description="Os lançamentos planejados gerados por essa recorrência também serão removidos. Lançamentos já pagos ficam intactos."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
