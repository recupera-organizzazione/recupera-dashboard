import { useEffect, useState } from 'react';
import { getKpi } from '../lib/api.js';

// Hook Parte 1: carica KPI reali da GET /dashboard/kpi
// Backend ritorna: { totale_prenotazioni, totale_da_garantire, totale_fuori_tmax }
// - loading / error / empty espliciti (obbligo AGENTS.md §5.3)
// - nessun numero inventato: se API assente, fallback demo etichettato
// Totali attesi da CSV (verifica Fase 1): BA 19.370, FG 10.042, LE 7.754, TA 7.113, BT 5.607, BR 4.686

const DEMO_FALLBACK = {
  totale_prenotazioni: null,
  totale_da_garantire: null,
  totale_fuori_tmax: null,
  _demo: true,
};

export function useKpi(settimana) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getKpi(settimana)
      .then((kpi) => {
        if (cancelled) return;
        // empty: API ok ma nessun dato (es. settimana senza rilevazioni)
        if (!kpi || (kpi.totale_prenotazioni === 0 && kpi.totale_da_garantire === 0)) {
          setData({ ...DEMO_FALLBACK, _empty: true });
        } else {
          setData({ ...kpi, _demo: false });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fallback demo etichettato, non blocca la UI esistente
        setData({ ...DEMO_FALLBACK, _error: err.message });
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [settimana]);

  const fuoriTmaxPct =
    data && data.totale_da_garantire > 0 && data.totale_fuori_tmax != null
      ? (data.totale_fuori_tmax / data.totale_da_garantire) * 100
      : null;

  return { data, loading, error, fuoriTmaxPct, isDemo: !data || data._demo === true };
}
