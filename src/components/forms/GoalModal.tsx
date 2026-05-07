import React, { useEffect, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import { createGoal, deleteGoal, updateGoal } from '../../lib/data';
import type { Goal, GoalStatus, GoalType } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Goal | null;
}

const types: { id: GoalType; label: string }[] = [
  { id: 'emergency_fund', label: 'Reserva de emergência' },
  { id: 'debt_free', label: 'Quitação de dívidas' },
  { id: 'investment', label: 'Investimento' },
  { id: 'purchase', label: 'Compra' },
  { id: 'custom', label: 'Outra' },
];

const statuses: { id: GoalStatus; label: string }[] = [
  { id: 'active', label: 'Ativa' },
  { id: 'completed', label: 'Concluída' },
  { id: 'paused', label: 'Pausada' },
  { id: 'canceled', label: 'Cancelada' },
];

export default function GoalModal({ open, onClose, onSaved, initial }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!initial;
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    deadline: '',
    type: 'custom' as GoalType,
    status: 'active' as GoalStatus,
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
        name: initial.name,
        target_amount: String(initial.target_amount ?? ''),
        current_amount: String(initial.current_amount ?? ''),
        deadline: initial.deadline ?? '',
        type: initial.type,
        status: initial.status,
      });
    } else {
      setForm({
        name: '',
        target_amount: '',
        current_amount: '0',
        deadline: '',
        type: 'custom',
        status: 'active',
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
      const payload = {
        name: form.name.trim(),
        target_amount: Number(form.target_amount) || 0,
        current_amount: Number(form.current_amount) || 0,
        deadline: form.deadline || null,
        type: form.type,
        status: form.status,
      };
      if (editing && initial) {
        await updateGoal(initial.id, payload);
        toast.success('Meta atualizada', payload.name);
      } else {
        await createGoal(user.id, payload);
        toast.success('Meta criada', payload.name);
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
      await deleteGoal(initial.id);
      toast.success('Meta excluída', initial.name);
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
      <Modal open={open} onClose={onClose} title={editing ? 'Editar meta' : 'Nova meta'} eyebrow="Meta">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="field-input"
              placeholder="Ex: Quitar cartão Visa"
              required
            />
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Meta total (R$)">
              <input
                type="number"
                step="0.01"
                value={form.target_amount}
                onChange={(e) => update('target_amount', e.target.value)}
                className="field-input num-mono"
                required
              />
            </Field>
            <Field label="Já guardado (R$)">
              <input
                type="number"
                step="0.01"
                value={form.current_amount}
                onChange={(e) => update('current_amount', e.target.value)}
                className="field-input num-mono"
              />
            </Field>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => update('type', e.target.value)} className="field-input">
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="field-input">
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prazo">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => update('deadline', e.target.value)}
                className="field-input"
              />
            </Field>
          </div>

          <FormFooter
            saving={saving}
            saveLabel={editing ? 'Salvar alterações' : 'Criar meta'}
            onCancel={onClose}
            errorMsg={errorMsg}
            destructive={editing ? { label: 'Excluir meta', onClick: () => setConfirmDel(true) } : undefined}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        title="Excluir meta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
