import React, { useState } from 'react';
import Ti from './Ti';
import ProfileModal from './forms/ProfileModal';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  userName: string;
}

type Item = { id: string; label: string; icon: string };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: 'I — Visão',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
      { id: 'dre', label: 'DRE', icon: 'report-analytics' },
      { id: 'projection', label: 'Projeção', icon: 'chart-line' },
    ],
  },
  {
    title: 'II — Movimentos',
    items: [
      { id: 'transactions', label: 'Transações', icon: 'transfer' },
      { id: 'recurring', label: 'Recorrentes', icon: 'repeat' },
      { id: 'accounts', label: 'Contas', icon: 'building-bank' },
    ],
  },
  {
    title: 'III — Plano',
    items: [
      { id: 'budget', label: 'Orçamento', icon: 'chart-pie' },
      { id: 'debts', label: 'Dívidas', icon: 'credit-card' },
      { id: 'goals', label: 'Metas', icon: 'target' },
    ],
  },
  {
    title: 'IV — Análise',
    items: [
      { id: 'analytics', label: 'Gráficos', icon: 'chart-pie' },
      { id: 'insights', label: 'Insights', icon: 'sparkles' },
    ],
  },
  {
    title: 'V — Sistema',
    items: [{ id: 'settings', label: 'Configurações', icon: 'settings' }],
  },
];

const monthLabel = () => {
  const m = new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return m.replace('.', '').replace(' de ', ' ');
};

export default function Sidebar({ currentPage, onPageChange, userName }: SidebarProps) {
  const initials = userName ? userName.slice(0, 2).toUpperCase() : 'CF';
  const [profileOpen, setProfileOpen] = useState(false);

  const closeMobile = () => document.body.classList.remove('sb-open');
  const handleNav = (id: string) => {
    onPageChange(id);
    closeMobile();
  };

  return (
    <>
      <aside
        data-role="sidebar"
        className="flex flex-col flex-shrink-0 h-full"
        style={{ width: 196, background: 'var(--surface)', borderRight: '0.5px solid var(--border)' }}
      >
        <div className="px-5 pt-[26px] pb-[30px]">
          <div className="font-serif text-[22px] text-text-1 leading-none" style={{ letterSpacing: '-0.02em' }}>
            Clareza<span className="text-green">.</span>
          </div>
          <div className="mt-[3px] text-2xs uppercase text-text-4" style={{ letterSpacing: '0.12em' }}>
            Finanças · {monthLabel()}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto pb-2">
          {groups.map((g) => (
            <div key={g.title} className="mb-[22px]">
              <div className="sb-sect">{g.title}</div>
              {g.items.map((it) => {
                const active = currentPage === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => handleNav(it.id)}
                    className={`sb-item ${active ? 'on' : ''}`}
                  >
                    <Ti name={it.icon} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4" style={{ borderTop: '0.5px solid var(--border-lt)' }}>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 w-full text-left hover:opacity-80 transition-opacity"
          >
            <div
              className="h-[30px] w-[30px] rounded-full flex items-center justify-center text-[11px] font-medium"
              style={{
                background: 'var(--green-lt)',
                color: 'var(--green)',
                border: '1px solid var(--green-md)',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-text-2 font-medium truncate capitalize">
                {userName || 'Convidado'}
              </div>
              <div className="text-2xs text-text-4">Perfil & ajustes</div>
            </div>
            <Ti name="settings" size={14} className="text-text-4" />
          </button>
        </div>
      </aside>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
