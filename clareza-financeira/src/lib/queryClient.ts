
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s: dado é considerado fresco. Não revalida ao focar a janela neste período.
      staleTime: 30_000,
      // 5 min: tempo que o cache é mantido em memória após nenhum componente usar.
      gcTime: 5 * 60_000,
      // Não refetch ao focar a janela (evita rajada de queries)
      refetchOnWindowFocus: false,
      // Mas refetch ao reconectar
      refetchOnReconnect: true,
      // Tenta 1 vez antes de desistir
      retry: 1,
      // Timeout efetivo via AbortController interno do supabase-js
    },
  },
});
