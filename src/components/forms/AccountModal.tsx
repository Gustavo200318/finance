import React, { useEffect, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../Toast';
import { useAuth } from '../../lib/auth';
import { createAccount, deleteAccount, updateAccount } from '../../lib/data';
import type { Account, AccountType } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Account | null;
}

const types: { id: AccountType; label: string }[] = [
  { id: 'checking', label: 'Conta corrente' },
  { id: 'savings', label: 'Poupança' },
  { id: 'cash', label: 'Dinheiro físico' },
  { id: 'credit_card', label: 'Cartão de crédito' },
  { id: 'investment', label: 'Investimentos' },
  { id: 'debt', label: 'Dívida' },
  { id: 'other', label: 'Outra' },
];

export default function AccountModal({ open, onClose, onSaved, initial }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!initial;
  const [form, setForm] = useState({
    name: '',
    type: 'checking' as AccountType,
    institution: '',
    initial_balance: '',
    is_active: true,
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
        type: initial.type,
        institution: initial.institution ?? '',
        initial_balance: String(initial.initial_balance ?? ''),
        is_active: initial.is_active,
      });
    } else {
      setForm({ name: '', type: 'checking', institution: '', initial_balance: '', is_active: true });
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
        type: form.type,
        institution: form.institution.trim() || null,
        initial_balance: Number(form.initial_balance) || 0,
        is_active: form.is_active,
      };
      if (editing && initial) {
        await updateAccount(initial.id, payload);
        toast.success('Conta atualizada', payload.name);
      } else {
        await createAccount(user.id, payload);
        toast.success('Conta criada', payload.name);
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
      await deleteAccount(initial.id);
      toast.success('Conta excluída', initial.name);
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
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Editar conta' : 'Nova conta'}
        eyebrow="Conta"
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="field-input"
              placeholder="Ex: Itaú · Conta corrente"
              required
            />
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => update('type', e.target.value)} className="field-input">
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Instituição">
              <input
                type="text"
                value={form.institution}
                onChange={(e) => update('institution', e.target.value)}
                className="field-input"
                placeholder="Banco, corretora..."
              />
            </Field>
          </div>

          <Field
            label="Saldo inicial (R$)"
            hint={editing ? 'Editar o saldo inicial não recalcula o histórico.' : 'Valor que essa conta tinha no momento da criação.'}
          >
            <input
              type="number"
              step="0.01"
              value={form.initial_balance}
              onChange={(e) => update('initial_balance', e.target.value)}
              className="field-input num-mono"
              placeholder="0,00"
            />
          </Field>

          <label className="flex items-center gap-2 text-[12px] text-text-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="h-3.5 w-3.5 accent-green rounded"
            />
            Conta ativa
          </label>

          <FormFooter
            saving={saving}
            saveLabel={editing ? 'Salvar alterações' : 'Criar conta'}
            onCancel={onClose}
            errorMsg={errorMsg}
            destructive={editing ? { label: 'Excluir conta', onClick: () => setConfirmDel(true) } : undefined}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        title="Excluir conta?"
        description="Todas as transações vinculadas a esta conta perderão a referência (não serão excluídas). Não dá pra desfazer."
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}
