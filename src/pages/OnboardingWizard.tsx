import React, { useState } from 'react';
import Ti from '../components/Ti';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { useOnboardingDone } from '../lib/preferences';
import {
  createAccount,
  createRecurring,
  updateProfile,
  type AccountInput,
} from '../lib/data';

interface Props {
  onDone: () => void;
}

interface AccountDraft {
  name: string;
  type: AccountInput['type'];
  initial_balance: string;
}

interface RecurringDraft {
  description: string;
  amount: string;
  type: 'income' | 'expense';
  day: string;
}

export default function OnboardingWizard({ onDone }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [, setOnboardingDone] = useOnboardingDone();

  // Step 1
  const [name, setName] = useState(profile?.name ?? '');
  const [goal, setGoal] = useState(String(profile?.monthly_income_goal ?? '0'));

  // Step 2
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: 'Conta corrente', type: 'checking', initial_balance: '0' },
  ]);

  // Step 3
  const [recs, setRecs] = useState<RecurringDraft[]>([
    { description: 'Aluguel', amount: '', type: 'expense', day: '5' },
  ]);

  const addAccount = () =>
    setAccounts((a) => [...a, { name: '', type: 'checking', initial_balance: '0' }]);
  const removeAccount = (i: number) => setAccounts((a) => a.filter((_, idx) => idx !== i));
  const updateAccount = (i: number, patch: Partial<AccountDraft>) =>
    setAccounts((a) => a.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addRec = () =>
    setRecs((r) => [...r, { description: '', amount: '', type: 'expense', day: '5' }]);
  const removeRec = (i: number) => setRecs((r) => r.filter((_, idx) => idx !== i));
  const updateRec = (i: number, patch: Partial<RecurringDraft>) =>
    setRecs((r) => r.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const skipAll = () => {
    setOnboardingDone(true);
    onDone();
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1) Update profile
      await updateProfile(user.id, {
        name: name.trim() || null,
        monthly_income_goal: Number(goal) || 0,
      });
      await refreshProfile();

      // 2) Create accounts (skip blanks)
      for (const a of accounts) {
        if (!a.name.trim()) continue;
        await createAccount(user.id, {
          name: a.name.trim(),
          type: a.type,
          initial_balance: Number(a.initial_balance) || 0,
        });
      }

      // 3) Create recurring (skip blanks)
      for (const r of recs) {
        if (!r.description.trim() || !r.amount) continue;
        const today = new Date();
        await createRecurring(user.id, {
          description: r.description.trim(),
          amount: Number(r.amount),
          type: r.type,
          account_id: null,
          category_id: null,
          frequency: 'monthly',
          day_of_month: Number(r.day) || today.getDate(),
          start_date: today.toISOString().slice(0, 10),
        });
      }

      setOnboardingDone(true);
      toast.success('Tudo pronto!', 'Seu Clareza está configurado.');
      onDone();
    } catch (e: any) {
      toast.error('Erro ao salvar', e?.message ?? 'Tente novamente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full"
        style={{ maxWidth: 640, background: 'var(--card)', borderRadius: 16, padding: '32px 36px', border: '0.5px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="hero-eyebrow text-green">Boas-vindas</div>
            <h1
              className="font-serif text-[26px] text-text-1 mt-1"
              style={{ letterSpacing: '-0.02em' }}
            >
              Configurando seu Clareza
            </h1>
          </div>
          <button
            onClick={skipAll}
            className="text-[11px] text-text-3 hover:text-text-1 px-2 py-1"
          >
            Pular tudo
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-7">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                style={{
                  background: step >= s ? 'var(--green)' : 'var(--bg)',
                  color: step >= s ? '#fff' : 'var(--text-3)',
                  border: step >= s ? 'none' : '0.5px solid var(--border)',
                }}
              >
                {step > s ? <Ti name="check" size={12} /> : s}
              </div>
              {s < 3 && (
                <div
                  className="flex-1 h-0.5"
                  style={{ background: step > s ? 'var(--green)' : 'var(--border)' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Steps */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="g-label" style={{ marginBottom: 6 }}>Passo 1 · Você</div>
              <h2 className="font-serif text-[20px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                Como devemos te chamar?
              </h2>
              <p className="text-[12px] text-text-3 mt-1">
                E qual sua receita mensal aproximada? Usamos pra calcular margem e te dar metas reais.
              </p>
            </div>
            <SettingsField label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="field-input"
                autoFocus
              />
            </SettingsField>
            <SettingsField
              label="Receita mensal aproximada (R$)"
              hint="Pode estimar — você ajusta depois em Configurações."
            >
              <input
                type="number"
                step="0.01"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="0,00"
                className="field-input num-mono"
              />
            </SettingsField>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <div className="g-label" style={{ marginBottom: 6 }}>Passo 2 · Suas contas</div>
              <h2 className="font-serif text-[20px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                Onde fica seu dinheiro?
              </h2>
              <p className="text-[12px] text-text-3 mt-1">
                Cadastre suas contas (banco, dinheiro, cartão). Pode pular e adicionar depois.
              </p>
            </div>
            <div className="space-y-3">
              {accounts.map((a, i) => (
                <div
                  key={i}
                  className="grid gap-2 items-end"
                  style={{ gridTemplateColumns: '1.4fr 1fr 1fr 24px' }}
                >
                  <input
                    value={a.name}
                    onChange={(e) => updateAccount(i, { name: e.target.value })}
                    placeholder="Ex: Nubank"
                    className="field-input"
                  />
                  <select
                    value={a.type}
                    onChange={(e) => updateAccount(i, { type: e.target.value as AccountInput['type'] })}
                    className="field-input"
                  >
                    <option value="checking">Corrente</option>
                    <option value="savings">Poupança</option>
                    <option value="cash">Dinheiro</option>
                    <option value="credit_card">Cartão</option>
                    <option value="investment">Investimento</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={a.initial_balance}
                    onChange={(e) => updateAccount(i, { initial_balance: e.target.value })}
                    placeholder="Saldo"
                    className="field-input num-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeAccount(i)}
                    className="text-text-4 hover:text-red"
                    title="Remover"
                  >
                    <Ti name="x" size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAccount}
                className="text-[11px] text-green hover:underline inline-flex items-center gap-1"
              >
                <Ti name="plus" size={11} /> Adicionar mais uma conta
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <div className="g-label" style={{ marginBottom: 6 }}>Passo 3 · Despesas e receitas fixas</div>
              <h2 className="font-serif text-[20px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                O que se repete todo mês?
              </h2>
              <p className="text-[12px] text-text-3 mt-1">
                Salário, aluguel, plano, assinaturas. Vamos lançar como recorrentes pra projetar seu fluxo.
              </p>
            </div>
            <div className="space-y-3">
              {recs.map((r, i) => (
                <div
                  key={i}
                  className="grid gap-2 items-end"
                  style={{ gridTemplateColumns: '1.5fr 1fr 0.7fr 0.7fr 24px' }}
                >
                  <input
                    value={r.description}
                    onChange={(e) => updateRec(i, { description: e.target.value })}
                    placeholder="Ex: Aluguel"
                    className="field-input"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) => updateRec(i, { amount: e.target.value })}
                    placeholder="Valor"
                    className="field-input num-mono"
                  />
                  <select
                    value={r.type}
                    onChange={(e) => updateRec(i, { type: e.target.value as 'income' | 'expense' })}
                    className="field-input"
                  >
                    <option value="expense">Saída</option>
                    <option value="income">Entrada</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={r.day}
                    onChange={(e) => updateRec(i, { day: e.target.value })}
                    placeholder="Dia"
                    className="field-input num-mono"
                    title="Dia do mês"
                  />
                  <button
                    type="button"
                    onClick={() => removeRec(i)}
                    className="text-text-4 hover:text-red"
                  >
                    <Ti name="x" size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRec}
                className="text-[11px] text-green hover:underline inline-flex items-center gap-1"
              >
                <Ti name="plus" size={11} /> Adicionar mais uma
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-6 mt-7"
          style={{ borderTop: '0.5px solid var(--border-lt)' }}
        >
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="text-[12px] text-text-3 hover:text-text-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-pill"
            >
              <Ti name="arrow-left" size={12} />
              Voltar
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="tb-btn">
              Continuar
              <Ti name="arrow-right" />
            </button>
          ) : (
            <button onClick={finish} disabled={saving} className="tb-btn">
              <Ti name="check" />
              {saving ? 'Salvando...' : 'Finalizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label" style={{ marginBottom: 0 }}>{label}</span>
      {children}
      {hint && <span className="text-[10px] text-text-4">{hint}</span>}
    </label>
  );
}
