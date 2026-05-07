import React from 'react';
import Ti from './Ti';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = 'sparkles', title, description, cta }: Props) {
  return (
    <div className="g flex flex-col items-center justify-center text-center" style={{ padding: '36px 24px' }}>
      <div
        className="h-12 w-12 rounded-full mb-4 flex items-center justify-center"
        style={{ background: 'var(--bg)', color: 'var(--text-3)' }}
      >
        <Ti name={icon} size={20} />
      </div>
      <h3 className="font-serif text-[18px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      {description && (
        <p className="text-[12px] text-text-3 mt-2 leading-relaxed max-w-md">{description}</p>
      )}
      {cta && (
        <button onClick={cta.onClick} className="tb-btn mt-5">
          <Ti name="plus" />
          {cta.label}
        </button>
      )}
    </div>
  );
}
