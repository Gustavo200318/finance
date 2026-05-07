import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Result {
  step: string;
  ok: boolean;
  detail: string;
}

export default function DiagnosticBanner() {
  const [results, setResults] = useState<Result[]>([]);
  const [hidden, setHidden] = useState(false);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Result[] = [];

      // 1) Env vars present?
      const url = process.env.REACT_APP_SUPABASE_URL ?? '';
      const key = process.env.REACT_APP_SUPABASE_ANON_KEY ?? '';
      out.push({
        step: '1. .env.local',
        ok: !!url && !!key,
        detail: `URL: ${url || 'AUSENTE'}  ·  KEY prefix: ${key.slice(0, 14) || 'AUSENTE'}…  ·  len=${key.length}`,
      });

      // 2) DNS / network reachable?
      const t0 = Date.now();
      try {
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`${url}/auth/v1/health`, { signal: ctrl.signal, headers: { apikey: key } });
        clearTimeout(tm);
        out.push({
          step: '2. Conectividade',
          ok: r.ok,
          detail: `HTTP ${r.status} em ${Date.now() - t0}ms`,
        });
      } catch (e: any) {
        out.push({
          step: '2. Conectividade',
          ok: false,
          detail: `${e?.name ?? 'Erro'}: ${e?.message ?? e}`,
        });
      }
      if (cancelled) return;
      setResults([...out]);

      // 3) Try a real Supabase query (RLS-protected)
      const t1 = Date.now();
      try {
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 4000);
        const { data, error } = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .abortSignal(ctrl.signal);
        clearTimeout(tm);
        if (error) {
          out.push({
            step: '3. Query (accounts)',
            ok: false,
            detail: `${error.message} (code=${error.code ?? '?'})`,
          });
        } else {
          out.push({
            step: '3. Query (accounts)',
            ok: true,
            detail: `OK em ${Date.now() - t1}ms, rows=${(data as any)?.length ?? 0}`,
          });
        }
      } catch (e: any) {
        out.push({
          step: '3. Query (accounts)',
          ok: false,
          detail: `${e?.name ?? 'Erro'}: ${e?.message ?? e}`,
        });
      }
      if (cancelled) return;

      // 4) Recurring table exists?
      try {
        const { error } = await supabase
          .from('recurring_transactions')
          .select('id', { count: 'exact', head: true });
        out.push({
          step: '4. Tabela recurring_transactions',
          ok: !error,
          detail: error
            ? `${error.message} — rode supabase_extras.sql no painel do Supabase`
            : 'OK',
        });
      } catch (e: any) {
        out.push({
          step: '4. Tabela recurring_transactions',
          ok: false,
          detail: `${e?.name ?? 'Erro'}: ${e?.message ?? e}`,
        });
      }
      if (!cancelled) setResults([...out]);

      // 5) Query transactions with category nested (the one the app actually uses)
      const t5 = Date.now();
      try {
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 6000);
        const { error } = await supabase
          .from('transactions')
          .select(
            '*, account:accounts!transactions_account_id_fkey(id,name,type), category:categories(id,name,icon,color,type,parent_id)'
          )
          .limit(5)
          .abortSignal(ctrl.signal);
        clearTimeout(tm);
        out.push({
          step: '5. Query nested (transactions+category+parent_id)',
          ok: !error,
          detail: error
            ? `${error.message} (code=${error.code ?? '?'})`
            : `OK em ${Date.now() - t5}ms`,
        });
      } catch (e: any) {
        out.push({
          step: '5. Query nested (transactions+category+parent_id)',
          ok: false,
          detail: `${e?.name ?? 'Erro'}: ${e?.message ?? e}`,
        });
      }

      if (!cancelled) {
        setResults([...out]);
        setRunning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  const allOk = results.length > 0 && results.every((r) => r.ok);
  if (!running && allOk) return null; // hide if everything is fine

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#0C1B2C',
        color: '#F0EDE6',
        padding: '14px 18px',
        borderRadius: 12,
        boxShadow: '0 16px 40px -8px rgba(0,0,0,0.4)',
        maxWidth: 720,
        width: 'calc(100% - 24px)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13, letterSpacing: '0.02em' }}>
          🔧 Diagnóstico Supabase {running ? '(rodando…)' : ''}
        </strong>
        <button
          onClick={() => setHidden(true)}
          style={{
            background: 'transparent',
            color: '#AABFCF',
            border: '0.5px solid rgba(255,255,255,0.2)',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          fechar
        </button>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {results.map((r, i) => (
          <li key={i} style={{ padding: '4px 0', borderTop: i ? '0.5px solid rgba(255,255,255,0.08)' : 'none' }}>
            <span style={{ color: r.ok ? '#2ECC8A' : '#E05C5C', marginRight: 6 }}>{r.ok ? '✓' : '✗'}</span>
            <strong>{r.step}</strong>
            <div style={{ color: '#AABFCF', fontSize: 11, marginLeft: 18, wordBreak: 'break-word' }}>{r.detail}</div>
          </li>
        ))}
        {running && results.length < 4 && (
          <li style={{ padding: '6px 0', color: '#AABFCF' }}>…executando próximo teste</li>
        )}
      </ul>
    </div>
  );
}
