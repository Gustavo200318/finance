
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 min: dado é considerado fresco — corta refetch desnecessário ao trocar de página
      staleTime: 5 * 60_000,
      // 10 min: cache em memória após nenhum componente usar
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
