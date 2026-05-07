import React, { useEffect, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import { createDebtPayment, createTransaction } from '../../lib/data';
import type { Debt } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  debt: Debt | null;
}

export default function DebtPaymentModal({ open, onClose, onSaved, debt }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
    create_transaction: true,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setForm({
      amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      notes: '',
      create_transaction: true,
    });
  }, [open]);

  if (!debt) return null;

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const amount = Number(form.amount);
      let txId: string | null = null;
      if (form.create_transaction) {
        const tx = await createTransaction(user.id, {
          description: `Pagamento — ${debt.creditor_name}`,
          amount,
          type: 'debt_payment',
          transaction_date: form.payment_date,
          account_id: null,
          category_id: null,
          notes: form.notes.trim() || null,
        });
        txId = tx.id;
      }
      await createDebtPayment(user.id, {
        debt_id: debt.id,
        amount,
        payment_date: form.payment_date,
        notes: form.notes.trim() || null,
        transaction_id: txId,
      });
      toast.success(
        'Pagamento registrado',
        `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${debt.creditor_name}`
      );
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao salvar');
      toast.error('Erro ao salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento" eyebrow={debt.creditor_name}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Valor (R$)">
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              className="field-input num-mono"
              placeholder="0,00"
              required
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => update('payment_date', e.target.value)}
              className="field-input"
              required
            />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="field-input"
            style={{ minHeight: 60, resize: 'vertical' }}
          />
        </Field>

        <label className="flex items-center gap-2 text-[12px] text-text-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.create_transaction}
            onChange={(e) => update('create_transaction', e.target.checked)}
            className="h-3.5 w-3.5 accent-green rounded"
          />
          Criar transação correspondente (recomendado — mantém DRE em dia)
        </label>

        <FormFooter saving={saving} saveLabel="Registrar pagamento" onCancel={onClose} errorMsg={errorMsg} />
      </form>
    </Modal>
  );
}
