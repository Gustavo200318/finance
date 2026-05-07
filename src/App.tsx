import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { queryClient } from './lib/queryClient';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function Shell() {
  const { user, profile, loading } = useAuth();
  const [showSkip, setShowSkip] = React.useState(false);

  React.useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setShowSkip(true), 1500);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px] animate-spin"
              style={{ borderColor: 'var(--text-3)', borderTopColor: 'transparent' }}
            />
            <span className="text-[12px] uppercase" style={{ letterSpacing: '0.14em' }}>
              Carregando
            </span>
          </div>
          {showSkip && (
            <div className="flex flex-col items-center gap-2 text-[11px]">
              <span className="text-text-3">Demorando demais? O Supabase pode estar fora do ar.</span>
              <a href="?skip=1" className="underline text-green">Ir para o login</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const userName = profile?.name || user.email?.split('@')[0] || 'Você';
  return <Dashboard userName={userName} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
