import React from 'react';
import Ti from './Ti';

interface Props {
  section: string;
  page: string;
  period?: string;
  onNewTransaction?: () => void;
  onImport?: () => void;
}

function currentMonthLabel() {
  const d = new Date();
  const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Topbar({ section, page, period, onNewTransaction, onImport }: Props) {
  const periodLabel = period ?? currentMonthLabel();
  return (
    <header
      className="flex items-center justify-between flex-shrink-0"
      style={{
        padding: '15px 28px',
        background: 'var(--surface)',
        borderBottom: '0.5px solid var(--border-lt)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          className="mobile-only h-8 w-8 rounded-full items-center justify-center"
          style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', color: 'var(--text-2)' }}
          onClick={() => document.body.classList.toggle('sb-open')}
          aria-label="Abrir menu"
        >
          <Ti name="menu-2" size={14} />
        </button>
        <div className="tb-bread">
          {section.toUpperCase()} / <span>{page.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="tb-pill" onClick={onImport}>
          <Ti name="upload" />
          Importar CSV
        </button>
        <button className="tb-pill" title="Mês corrente do app (use os filtros nas páginas para mudar período)">
          <Ti name="calendar" />
          {periodLabel}
        </button>
        <button className="tb-btn" onClick={onNewTransaction}>
          <Ti name="plus" />
          Nova transação
        </button>
      </div>
    </header>
  );
}
