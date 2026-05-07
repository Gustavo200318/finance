import React, { useMemo, useState } from 'react';
import Ti from '../components/Ti';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

type Mode = 'sign-in' | 'sign-up';

type FieldErrors = {
  email?: string;
  password?: string;
  name?: string;
};

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isSignUp = mode === 'sign-up';

  const helperText = useMemo(() => {
    if (isSignUp) return 'Crie sua conta com calma. O acesso e privado e sem distrações.';
    return 'Entre para acompanhar sua DRE pessoal com mais clareza e menos ruido.';
  }, [isSignUp]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validateForm({ email, password, name, isSignUp });
    setFieldErrors(nextErrors);
    setErrorMsg(null);
    setInfo(null);

    if (Object.keys(nextErrors).length > 0) {
      setErrorMsg('Revise os campos destacados e tente novamente.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email.trim(), password, name.trim() || undefined);
        if (error) throw error;
        setInfo('Conta criada. Se houver confirmacao por email, valide sua caixa de entrada antes de acessar.');
        setMode('sign-in');
        setPassword('');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (error: any) {
      setErrorMsg(translateError(error?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const resetFeedback = () => {
    setErrorMsg(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      <div
        className="login-grid grid w-full max-w-[1080px] overflow-hidden"
        style={{
          gridTemplateColumns: '1.1fr 1fr',
          background: 'var(--bg)',
          borderRadius: 20,
          boxShadow: '0 4px 60px rgba(12,27,44,0.12)',
        }}
      >
        <section
          className="flex flex-col justify-between p-12 lg:p-14"
          style={{ background: 'var(--surface)', borderRight: '0.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="font-serif text-[22px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
              Clareza<span className="text-green">.</span>
            </div>
            <div className="h-[0.5px] flex-1 max-w-[100px]" style={{ background: 'var(--border)' }} />
            <div className="text-2xs uppercase text-text-4" style={{ letterSpacing: '0.14em' }}>
              Edicao 01
            </div>
          </div>

          <div className="my-12 max-w-xl">
            <div className="hero-eyebrow text-text-4">Editorial</div>
            <h1 className="hero-h" style={{ fontSize: 44, lineHeight: 1.05, marginTop: 4 }}>
              Suas financas,
              <br />
              <em>em prosa clara.</em>
            </h1>
            <p className="hero-note" style={{ maxWidth: 460, fontSize: 13, marginTop: 14 }}>
              Receitas, despesas, dividas e metas em uma so pagina. Sem ruido visual, sem mensagens cruas
              e sem sensacao de sistema improvisado.
            </p>
          </div>

          <div className="grid gap-3 text-[11px] text-text-3">
            <FeatureRow icon="shield-lock" text="Acesso privado com autenticacao segura." />
            <FeatureRow icon="sparkles" text="Feedback claro quando algo falhar ou precisar de atencao." />
            <FeatureRow icon="database" text="Integrado ao Supabase com mensagens tratadas no produto." />
          </div>
        </section>

        <section className="flex items-center justify-center p-10 lg:p-14 bg-card">
          <div className="w-full max-w-[360px]">
            <div className="mb-8">
              <div className="hero-eyebrow text-green">Acesso</div>
              <h2 className="font-serif text-[28px] text-text-1 mt-1" style={{ letterSpacing: '-0.02em' }}>
                {isSignUp ? 'Criar conta' : 'Entrar'}
              </h2>
              <p className="text-[12px] text-text-3 mt-2 leading-relaxed">{helperText}</p>
            </div>

            {!isSupabaseConfigured && (
              <StatusCard tone="warning" title="Ambiente ainda nao configurado">
                Preencha <code className="bg-white px-1 rounded">REACT_APP_SUPABASE_URL</code> e{' '}
                <code className="bg-white px-1 rounded">REACT_APP_SUPABASE_ANON_KEY</code> no arquivo{' '}
                <code className="bg-white px-1 rounded">.env.local</code> e reinicie o servidor.
              </StatusCard>
            )}

            <form onSubmit={submit} noValidate className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="field-label">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldErrors((current) => ({ ...current, name: undefined }));
                    }}
                    placeholder="Como devemos te chamar"
                    className="field-input"
                    aria-invalid={Boolean(fieldErrors.name)}
                    style={getFieldStyle(Boolean(fieldErrors.name))}
                  />
                  {fieldErrors.name && <FieldMessage>{fieldErrors.name}</FieldMessage>}
                </div>
              )}

              <div>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((current) => ({ ...current, email: undefined }));
                  }}
                  placeholder="seu@email.com"
                  className="field-input"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  style={getFieldStyle(Boolean(fieldErrors.email))}
                />
                {fieldErrors.email && <FieldMessage>{fieldErrors.email}</FieldMessage>}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="field-label">Senha</label>
                  {!isSignUp && (
                    <button type="button" className="text-[10px] text-text-3 hover:text-green">
                      esqueci
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder="Digite sua senha"
                  className="field-input"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  style={getFieldStyle(Boolean(fieldErrors.password))}
                />
                {fieldErrors.password ? (
                  <FieldMessage>{fieldErrors.password}</FieldMessage>
                ) : (
                  <div className="text-[10px] text-text-4 mt-1">
                    {isSignUp ? 'Use pelo menos 6 caracteres.' : 'Sua senha nunca aparece em texto aberto.'}
                  </div>
                )}
              </div>

              {errorMsg && (
                <StatusCard tone="error" title="Nao foi possivel continuar">
                  {errorMsg}
                </StatusCard>
              )}

              {info && (
                <StatusCard tone="success" title="Tudo certo">
                  {info}
                </StatusCard>
              )}

              <button
                type="submit"
                disabled={loading}
                className="tb-btn w-full justify-center mt-2"
                style={{ padding: '10px 14px', fontSize: 12.5, opacity: loading ? 0.88 : 1 }}
              >
                {loading ? (
                  'Validando...'
                ) : isSignUp ? (
                  <>
                    Criar conta
                    <Ti name="arrow-right" />
                  </>
                ) : (
                  <>
                    Entrar
                    <Ti name="arrow-right" />
                  </>
                )}
              </button>
            </form>

            <div
              className="mt-7 pt-5 flex items-center justify-between text-[10px] uppercase text-text-4"
              style={{ borderTop: '0.5px solid var(--border-lt)', letterSpacing: '0.12em' }}
            >
              <span>{isSignUp ? 'Ja tem conta?' : 'Nao tem conta?'}</span>
              <button
                onClick={() => {
                  setMode(isSignUp ? 'sign-in' : 'sign-up');
                  setFieldErrors({});
                  resetFeedback();
                }}
                className="hover:text-green flex items-center gap-1"
              >
                {isSignUp ? 'Entrar' : 'Criar conta'}
                <Ti name="arrow-right" size={11} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function validateForm({
  email,
  password,
  name,
  isSignUp,
}: {
  email: string;
  password: string;
  name: string;
  isSignUp: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!email.trim()) {
    errors.email = 'Informe seu email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Digite um email valido.';
  }

  if (!password) {
    errors.password = 'Informe sua senha.';
  } else if (password.length < 6) {
    errors.password = 'A senha precisa ter pelo menos 6 caracteres.';
  }

  if (isSignUp && name.trim() && name.trim().length < 2) {
    errors.name = 'Use ao menos 2 caracteres no nome.';
  }

  return errors;
}

function translateError(msg: string): string {
  if (!msg) return 'Ocorreu um erro inesperado. Tente novamente em instantes.';
  if (/invalid login credentials/i.test(msg)) return 'Email ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu email antes de entrar.';
  if (/already registered/i.test(msg)) return 'Esse email ja esta cadastrado.';
  if (/password.*at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/email rate limit exceeded/i.test(msg)) {
    return 'Voce atingiu o limite temporario de envio de emails. Aguarde alguns minutos antes de tentar novo cadastro, confirmacao ou recuperacao de senha.';
  }
  if (/too many requests/i.test(msg)) return 'Houve tentativas demais em pouco tempo. Aguarde um pouco e tente de novo.';
  if (/network/i.test(msg)) return 'Nao foi possivel conectar ao Supabase. Verifique o ambiente e tente novamente.';
  return msg;
}

function getFieldStyle(hasError: boolean): React.CSSProperties | undefined {
  if (!hasError) return undefined;
  return {
    borderColor: 'var(--red)',
    boxShadow: '0 0 0 3px rgba(184, 58, 48, 0.10)',
  };
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full"
        style={{ background: 'rgba(11, 104, 71, 0.08)', color: 'var(--green)' }}
      >
        <Ti name={icon} size={14} />
      </span>
      <span>{text}</span>
    </div>
  );
}

function FieldMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-[10.5px]" style={{ color: 'var(--red)' }}>
      {children}
    </div>
  );
}

function StatusCard({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'error' | 'warning';
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    success: { bg: 'var(--green-lt)', fg: 'var(--green)', border: 'rgba(11, 104, 71, 0.16)', icon: 'circle-check' },
    error: { bg: 'var(--red-lt)', fg: 'var(--red)', border: 'rgba(184, 58, 48, 0.16)', icon: 'alert-circle' },
    warning: { bg: 'var(--amber-lt)', fg: 'var(--amber)', border: 'rgba(138, 96, 16, 0.16)', icon: 'alert-triangle' },
  }[tone];

  return (
    <div
      className="px-4 py-3 rounded-[12px] text-[11.5px] flex items-start gap-2"
      style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}` }}
    >
      <Ti name={styles.icon} size={14} className="mt-0.5 shrink-0" />
      <div className="leading-relaxed">
        <div className="font-medium text-[12px]">{title}</div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
