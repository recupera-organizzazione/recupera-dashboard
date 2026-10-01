import { useQuery } from '@tanstack/react-query';
import { getKpi } from '../lib/api.js';

// Hook Parte 2: stessi ritorni della Parte 1 ({ data, loading, error, fuoriTmaxPct, isDemo })
// ma con cache TanStack Query. MetricGrid.jsx non cambia interfaccia.
// Backend: { totale_prenotazioni, totale_da_garantire, totale_fuori_tmax }
// Totali attesi CSV: BA 19.370, FG 10.042, LE 7.754, TA 7.113, BT 5.607, BR 4.686

export function useKpi(settimana) {
  const query = useQuery({
    queryKey: ['kpi', settimana || 'default'],
    queryFn: () => getKpi(settimana),
  });

  const raw = query.data;
  const isEmpty =
    !!raw && (raw.totale_prenotazioni === 0 && raw.totale_da_garantire === 0);

  // Fallback demo etichettato: non inventa numeri, MetricGrid mostra error + demo esistenti
  const data = raw
    ? { ...raw, _demo: false, ...(isEmpty ? { _empty: true } : {}) }
    : query.isError
      ? {
          totale_prenotazioni: null,
          totale_da_garantire: null,
          totale_fuori_tmax: null,
          _demo: true,
          _error: query.error?.message,
        }
      : null;

  const fuoriTmaxPct =
    data && data.totale_da_garantire > 0 && data.totale_fuori_tmax != null
      ? (data.totale_fuori_tmax / data.totale_da_garantire) * 100
      : null;

  return {
    data,
    loading: query.isLoading,
    error: query.isError ? query.error?.message || 'Errore sconosciuto' : null,
    fuoriTmaxPct,
    isDemo: !data || data._demo === true,
    // esposti per debug / future parti (grafico, territorio)
    isEmpty,
    refetch: query.refetch,
  };
}
