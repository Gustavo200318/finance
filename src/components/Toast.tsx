import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Ti from './Ti';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (input: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (input: Omit<ToastItem, 'id'>) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { ...input, id }]);
      window.setTimeout(() => remove(id), 3600);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 360 }}
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const config = {
    success: { icon: 'circle-check', color: 'var(--green)', bg: 'var(--green-lt)', border: 'var(--green-md)' },
    error: { icon: 'alert-circle', color: 'var(--red)', bg: 'var(--red-lt)', border: 'rgba(184, 58, 48, 0.3)' },
    info: { icon: 'info-circle', color: 'var(--slate)', bg: '#EBF2FB', border: 'var(--border)' },
  }[item.tone];

  return (
    <div
      className="pointer-events-auto animate-toast-in g"
      style={{
        padding: '12px 14px',
        borderLeft: `2px solid ${config.color}`,
        minWidth: 280,
        background: 'var(--card)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: config.bg, color: config.color }}
        >
          <Ti name={config.icon} size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-text-1">{item.title}</div>
          {item.description && (
            <div className="text-[11px] text-text-3 mt-0.5 leading-relaxed">{item.description}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-text-4 hover:text-text-1 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <Ti name="x" size={13} />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: no provider, return no-op API so components don't break
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    } as ToastApi;
  }
  return ctx;
}
