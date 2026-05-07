import React, { useEffect, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import { createDebt, deleteDebt, updateDebt } from '../../lib/data';
import type { Debt, DebtStatus } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Debt | null;
}

const statusOptions: { id: DebtStatus; label: string }[] = [
  { id: 'open', label: 'Aberta' },
  { id: 'renegotiated', label: 'Renegociada' },
  { id: 'paid', label: 'Quitada' },
  { id: 'overdue', label: 'Atrasada' },
  { id: 'defaulted', label: 'Em default' },
];

export default function DebtModal({ open, onClose, onSaved, initial }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!initial;
  const [form, setForm] = useState({
    creditor_name: '',
    original_amount: '',
    current_amount: '',
    interest_rate: '',
    due_date: '',
    status: 'open' as DebtStatus,
    priority: 1,
    renegotiation_available: false,
    notes: '',
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
        creditor_name: initial.creditor_name,
        original_amount: String(initial.original_amount ?? ''),
        current_amount: String(initial.current_amount ?? ''),
        interest_rate: initial.interest_rate != null ? String(initial.interest_rate) : '',
        due_date: initial.due_date ?? '',
        status: initial.status,
        priority: initial.priority,
        renegotiation_available: initial.renegotiation_available,
        notes: initial.notes ?? '',
      });
    } else {
      setForm({
        creditor_name: '',
        original_amount: '',
        current_amount: '',
        interest_rate: '',
        due_date: '',
        status: 'open',
        priority: 1,
        renegotiation_available: false,
        notes: '',
      });
    }
  }, [open, initial]);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const original = Number(form.original_amount) || 0;
      const current =
        form.current_amount !== '' ? Number(form.current_amount) : original;
      const payload = {
        creditor_name: form.creditor_name.trim(),
        original_amount: original,
        current_amount: current,
        interest_rate: form.interest_rate !== '' ? Number(form.interest_rate) : null,
        due_date: form.due_date || null,
        status: form.status,
        renegotiation_available: form.renegotiation_available,
        priority: Number(form.priority) || 1,
        notes: form.notes.trim() || null,
      };
      if (editing && initial) {
        await updateDebt(initial.id, payload);
        toast.success('Dívida atualizada', payload.creditor_name);
      } else {
        await createDebt(user.id, payload);
        toast.success('Dívida registrada', payload.creditor_name);
      }
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
      await deleteDebt(initial.id);
      toast.success('Dívida excluída', initial.creditor_name);
      setConfirmDel(false);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao excluir');
      toast.error('Erro ao excluir', e.message);
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? 'Editar dívida' : 'Nova dívida'} eyebrow="Passivo">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Credor">
            <input
              type="text"
              value={form.creditor_name}
              onChange={(e) => update('creditor_name', e.target.value)}
              className="field-input"
              placeholder="Ex: Cartão Visa · BB"
              required
            />
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Valor original (R$)">
              <input
                type="number"
                step="0.01"
                value={form.original_amount}
                onChange={(e) => update('original_amount', e.target.value)}
                className="field-input num-mono"
                required
              />
            </Field>
            <Field label="Saldo devedor (R$)" hint="Default: igual ao valor original">
              <input
                type="number"
                step="0.01"
                value={form.current_amount}
                onChange={(e) => update('current_amount', e.target.value)}
                className="field-input num-mono"
                placeholder={form.original_amount}
              />
            </Field>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="Juros (% a.m.)">
              <input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => update('interest_rate', e.target.value)}
                className="field-input num-mono"
                placeholder="—"
              />
            </Field>
            <Field label="Vencimento">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => update('due_date', e.target.value)}
                className="field-input"
              />
            </Field>
            <Field label="Prioridade">
              <select value={form.priority} onChange={(e) => update('priority', Number(e.target.value))} className="field-input">
                <option value={3}>Alta</option>
                <option value={2}>Média</option>
                <option value={1}>Baixa</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Status">
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="field-input">
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-end gap-2 text-[12px] text-text-2 cursor-pointer select-none pb-2">
              <input
                type="checkbox"
                checked={form.renegotiation_available}
                onChange={(e) => update('renegotiation_available', e.target.checked)}
                className="h-3.5 w-3.5 accent-green rounded"
              />
              Renegociação disponível
            </label>
          </div>

          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className="field-input"
              style={{ minHeight: 60, resize: 'vertical' }}
              placeholder="Dica, estratégia, prazo, etc."
            />
          </Field>

          <FormFooter
            saving={saving}
            saveLabel={editing ? 'Salvar alterações' : 'Criar dívida'}
            onCancel={onClose}
            errorMsg={errorMsg}
            destructive={editing ? { label: 'Excluir dívida', onClick: () => setConfirmDel(true) } : undefined}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        title="Excluir dívida?"
        description="Os pagamentos vinculados também serão excluídos. Não dá pra desfazer."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
