import { QueryClient } from '@tanstack/react-query';

// Defaults dashboard admin: dati semi-statici (CSV settimanale), niente refetch aggressivo.
// - staleTime 30s: evita refetch a ogni mount delle card
// - retry 1: backend locale/Supabase può essere down, mostra subito error fallback (obbligo AGENTS §5.3)
// - refetchOnWindowFocus false: evita curl inutili su Supabase
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
