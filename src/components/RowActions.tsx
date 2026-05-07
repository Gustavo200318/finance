import React, { useEffect, useRef, useState } from 'react';
import Ti from './Ti';

interface Action {
  label: string;
  icon: string;
  onClick: () => void;
  destructive?: boolean;
}

interface Props {
  actions: Action[];
}

export default function RowActions({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="h-7 w-7 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg transition-colors"
        aria-label="Ações"
      >
        <Ti name="dots" size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[160px] py-1.5"
          style={{
            background: 'var(--card)',
            border: '0.5px solid var(--border)',
            borderTop: '1px solid var(--card-top)',
            borderRadius: 12,
            boxShadow: '0 8px 24px -4px rgba(12, 27, 44, 0.12)',
          }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                a.onClick();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-left transition-colors hover:bg-bg"
              style={a.destructive ? { color: 'var(--red)' } : { color: 'var(--text-2)' }}
            >
              <Ti name={a.icon} size={13} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
