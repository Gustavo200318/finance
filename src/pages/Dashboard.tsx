import React, { Suspense, lazy, useCallback, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import TransactionModal from '../components/TransactionModal';
import { Skeleton } from '../components/Skeleton';
import { useOnboardingDone } from '../lib/preferences';

// Eager: páginas mais quentes (Dashboard sempre é o landing, Onboarding bloqueia)
import DashboardPage from './DashboardPage';
import OnboardingWizard from './OnboardingWizard';

// Lazy: páginas secundárias viram chunks separados
const TransactionsPage = lazy(() => import('./TransactionsPage'));
const AccountsPage = lazy(() => import('./AccountsPage'));
const DebtsPage = lazy(() => import('./DebtsPage'));
const BudgetPage = lazy(() => import('./BudgetPage'));
const GoalsPage = lazy(() => import('./GoalsPage'));
const InsightsPage = lazy(() => import('./InsightsPage'));
const DREPage = lazy(() => import('./DREPage'));
const RecurringPage = lazy(() => import('./RecurringPage'));
const ProjectionPage = lazy(() => import('./ProjectionPage'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));

interface DashboardProps {
  userName: string;
}

const meta: Record<string, { section: string; page: string }> = {
  dashboard: { section: 'I — Visão', page: 'Dashboard' },
  dre: { section: 'I — Visão', page: 'DRE' },
  projection: { section: 'I — Visão', page: 'Projeção' },
  transactions: { section: 'II — Movimentos', page: 'Transações' },
  recurring: { section: 'II — Movimentos', page: 'Recorrentes' },
  accounts: { section: 'II — Movimentos', page: 'Contas' },
  budget: { section: 'III — Plano', page: 'Orçamento' },
  debts: { section: 'III — Plano', page: 'Dívidas' },
  goals: { section: 'III — Plano', page: 'Metas' },
  analytics: { section: 'IV — Análise', page: 'Gráficos' },
  insights: { section: 'IV — Análise', page: 'Insights' },
  settings: { section: 'V — Sistema', page: 'Configurações' },
};

export default function Dashboard({ userName }: DashboardProps) {
  const [page, setPage] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [onboardingDone, setOnboardingDone] = useOnboardingDone();

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const onSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (!onboardingDone) {
    return (
      <OnboardingWizard
        onDone={() => {
          setOnboardingDone(true);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage userName={userName} onNewTransaction={openModal} onNavigate={setPage} refreshKey={refreshKey} />;
      case 'dre':
        return <DREPage refreshKey={refreshKey} />;
      case 'projection':
        return <ProjectionPage refreshKey={refreshKey} onNavigate={setPage} />;
      case 'transactions':
        return <TransactionsPage onNewTransaction={openModal} refreshKey={refreshKey} />;
      case 'recurring':
        return <RecurringPage refreshKey={refreshKey} onSaved={onSaved} />;
      case 'accounts':
        return <AccountsPage refreshKey={refreshKey} />;
      case 'debts':
        return <DebtsPage refreshKey={refreshKey} />;
      case 'budget':
        return <BudgetPage refreshKey={refreshKey} />;
      case 'goals':
        return <GoalsPage refreshKey={refreshKey} />;
      case 'analytics':
        return <AnalyticsPage refreshKey={refreshKey} />;
      case 'insights':
        return <InsightsPage refreshKey={refreshKey} />;
      case 'settings':
        return <SettingsPage refreshKey={refreshKey} />;
      default:
        return <DashboardPage userName={userName} onNewTransaction={openModal} onNavigate={setPage} refreshKey={refreshKey} />;
    }
  };

  const m = meta[page] ?? meta.dashboard;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar currentPage={page} onPageChange={setPage} userName={userName} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar section={m.section} page={m.page} onNewTransaction={openModal} />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageSkeleton />}>{renderPage()}</Suspense>
        </main>
      </div>
      <TransactionModal open={modalOpen} onClose={closeModal} onSaved={onSaved} />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="content flex flex-col gap-3" style={{ padding: '26px 28px' }}>
      <Skeleton height={92} />
      <Skeleton height={180} />
      <Skeleton height={140} />
    </div>
  );
}
