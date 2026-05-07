import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div
        className="g w-full"
        style={{ maxWidth: 520, padding: 32, textAlign: 'center' }}
      >
        <div
          className="h-14 w-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--red-lt)', color: 'var(--red)' }}
        >
          <i className="ti ti-alert-triangle" style={{ fontSize: 24 }} />
        </div>
        <h1 className="font-serif text-[26px] text-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>
          Algo quebrou por aqui.
        </h1>
        <p className="text-[12.5px] text-text-3 mb-5 leading-relaxed">
          Não se preocupe, seus dados estão seguros. Tente recarregar — se persistir, copie a mensagem abaixo e
          fale com o suporte.
        </p>
        <pre
          className="text-[11px] text-left p-3 mb-5 rounded-lg overflow-auto"
          style={{
            background: 'var(--bg)',
            color: 'var(--red)',
            border: '0.5px solid var(--border)',
            maxHeight: 160,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {error.message}
        </pre>
        <div className="flex items-center justify-center gap-2">
          <button onClick={reset} className="tb-pill">
            <i className="ti ti-refresh" /> Tentar de novo
          </button>
          <button onClick={() => window.location.reload()} className="tb-btn">
            <i className="ti ti-reload" /> Recarregar app
          </button>
        </div>
      </div>
    </div>
  );
}
