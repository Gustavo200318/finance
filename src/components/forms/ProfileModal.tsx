import React, { useEffect, useState } from 'react';
import Modal, { Field, FormFooter } from '../Modal';
import { useAuth } from '../../lib/auth';
import { useToast } from '../Toast';
import { updateProfile } from '../../lib/data';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    currency: 'BRL',
    monthly_income_goal: '',
  });
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
      toast.info('Você saiu da conta');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Erro ao sair');
      toast.error('Erro ao sair', e?.message);
      setSigningOut(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setForm({
      name: profile?.name ?? '',
      currency: profile?.currency ?? 'BRL',
      monthly_income_goal: String(profile?.monthly_income_goal ?? '0'),
    });
  }, [open, profile]);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateProfile(user.id, {
        name: form.name.trim() || null,
        currency: form.currency.trim() || 'BRL',
        monthly_income_goal: Number(form.monthly_income_goal) || 0,
      });
      await refreshProfile();
      toast.success('Perfil atualizado');
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao salvar');
      toast.error('Erro ao salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Seu perfil" eyebrow="Conta">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" value={user?.email ?? ''} className="field-input" disabled />
        </Field>

        <Field label="Nome">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="field-input"
            placeholder="Como devemos te chamar"
          />
        </Field>

        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Moeda">
            <select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              className="field-input"
            >
              <option value="BRL">BRL · Real</option>
              <option value="USD">USD · Dólar</option>
              <option value="EUR">EUR · Euro</option>
            </select>
          </Field>
          <Field label="Meta de receita mensal" hint="Opcional">
            <input
              type="number"
              step="0.01"
              value={form.monthly_income_goal}
              onChange={(e) => update('monthly_income_goal', e.target.value)}
              className="field-input num-mono"
            />
          </Field>
        </div>

        <FormFooter
          saving={saving}
          saveLabel="Salvar perfil"
          onCancel={onClose}
          errorMsg={errorMsg}
          destructive={{
            label: 'Sair da conta',
            loadingLabel: 'Saindo...',
            icon: 'logout',
            onClick: handleSignOut,
            loading: signingOut,
          }}
        />
      </form>
    </Modal>
  );
}
