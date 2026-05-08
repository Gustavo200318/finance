import React, { useEffect, useRef } from 'react';
import Ti from './Ti';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  width?: number;
  children: React.ReactNode;
  /** if true, asks for confirmation when closing via backdrop/ESC. */
  dirty?: boolean;
}

export default function Modal({ open, onClose, title, eyebrow, width = 520, children, dirty }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    window.addEventListener('keydown', onKey);

    // auto-focus first focusable input/select/textarea
    const t = window.setTimeout(() => {
      const first = cardRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
      );
      first?.focus();
    }, 80);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tryClose = () => {
    if (dirty) {
      const ok = window.confirm('Você tem alterações não salvas. Fechar mesmo assim?');
      if (!ok) return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(12, 27, 44, 0.35)', backdropFilter: 'blur(2px)' }}
        onClick={tryClose}
      />
      <div
        ref={cardRef}
        className="g modal-card relative w-full max-h-[92vh] overflow-y-auto animate-scale-in"
        style={{ padding: 28, maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between mb-6">
          <div>
            {eyebrow && <div className="hero-eyebrow text-green">{eyebrow}</div>}
            <h2 className="font-serif text-[24px] text-text-1 mt-1" style={{ letterSpacing: '-0.02em' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={tryClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg transition-colors"
            aria-label="Fechar"
          >
            <Ti name="x" size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

interface FormFooterProps {
  saving?: boolean;
  saveLabel?: string;
  onCancel: () => void;
  errorMsg?: string | null;
  destructive?: { label: string; onClick: () => void; loading?: boolean; loadingLabel?: string; icon?: string };
}

export function FormFooter({ saving, saveLabel = 'Salvar', onCancel, errorMsg, destructive }: FormFooterProps) {
  return (
    <>
      {errorMsg && (
        <div
          className="px-3 py-2 rounded-[10px] text-[11.5px] mb-3 flex items-start gap-2"
          style={{ background: 'var(--red-lt)', color: 'var(--red)' }}
        >
          <Ti name="alert-circle" size={13} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div
        className="flex items-center justify-end gap-2 pt-3"
        style={{ borderTop: '0.5px solid var(--border-lt)' }}
      >
        {destructive && (
          <button
            type="button"
            onClick={destructive.onClick}
            disabled={destructive.loading || saving}
            className="text-[12px] text-red hover:text-red px-3 py-2 rounded-pill mr-auto disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <Ti name={destructive.icon ?? 'trash'} size={12} />
            {destructive.loading ? (destructive.loadingLabel ?? 'Excluindo...') : destructive.label}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-[12px] text-text-3 hover:text-text-1 px-3 py-2 rounded-pill"
        >
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="tb-btn">
          {saving ? (
            <>
              <span
                className="inline-block h-3 w-3 rounded-full border-[1.5px] animate-spin"
                style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
              />
              Salvando...
            </>
          ) : (
            <>
              <Ti name="check" />
              {saveLabel}
            </>
          )}
        </button>
      </div>
    </>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string | null;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label" style={{ marginBottom: 0 }}>
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[10px] text-red flex items-center gap-1">
          <Ti name="alert-circle" size={11} />
          {error}
        </span>
      ) : hint ? (
        <span className="text-[10px] text-text-4">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls = 'field-input';
