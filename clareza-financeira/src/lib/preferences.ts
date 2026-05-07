import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'clareza_pref_';

export function usePref<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const fullKey = STORAGE_PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {}
  }, [fullKey, value]);

  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => (typeof v === 'function' ? (v as (p: T) => T)(prev) : v));
    },
    []
  );

  return [value, update];
}

// ─── Dashboard widgets ──────────────────────────────────────────────────
export type DashboardWidgetId =
  | 'kpis'
  | 'attention'
  | 'categories'
  | 'recent'
  | 'debts';

export const ALL_WIDGETS: { id: DashboardWidgetId; label: string; description: string }[] = [
  { id: 'kpis', label: 'Cards de KPI', description: 'Resultado, receita, despesas, reserva' },
  { id: 'attention', label: 'Atenção do mês', description: 'Insights destacados' },
  { id: 'categories', label: 'Gastos por categoria', description: 'Donut + barra colorida' },
  { id: 'recent', label: 'Transações recentes', description: 'Últimas 5 movimentações' },
  { id: 'debts', label: 'Dívidas em aberto', description: 'Card lateral com top dívidas' },
];

const DEFAULT_WIDGETS: Record<DashboardWidgetId, boolean> = {
  kpis: true,
  attention: true,
  categories: true,
  recent: true,
  debts: true,
};

export function useDashboardWidgets() {
  return usePref<Record<DashboardWidgetId, boolean>>('dashboard_widgets', DEFAULT_WIDGETS);
}

// ─── Onboarding ─────────────────────────────────────────────────────────
export function useOnboardingDone(): [boolean, (v: boolean) => void] {
  return usePref<boolean>('onboarding_done', false);
}
