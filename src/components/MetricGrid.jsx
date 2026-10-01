import MetricCard from './MetricCard.jsx';
import { useKpi } from '../hooks/useKpi.js';

// Valori mock storici — etichettati demo fino a Fase 2 completa.
// Non aggiungere nuovi numeri qui (AGENTS.md §1).
const DEMO_METRICS = [
  {
    label: 'Slot recuperati',
    value: '284',
    trend: '+12,4%',
    note: 'rispetto alla scorsa settimana',
    type: 'emphasis',
  },
  {
    label: 'Giorni restituiti',
    value: '1.426',
    trend: '+8,1%',
    note: (
      <>
        media per paziente <b>5,0 giorni</b>
      </>
    ),
    type: 'days',
  },
  {
    label: 'Tasso di conferma',
    value: '78,6',
    unit: '%',
    trend: 'stabile',
    note: 'su 361 proposte inviate',
    type: 'confirmation',
  },
  {
    label: 'Zone sotto pressione',
    value: '3',
    trend: 'attenzione',
    note: 'oltre il 20% di capacità inutilizzata',
    type: 'pressure',
  },
];

function formatIT(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('it-IT');
}

export default function MetricGrid({ settimana }) {
  const { data, loading, error, fuoriTmaxPct, isDemo } = useKpi(settimana);

  return (
    <>
      {/* Barra KPI reali — unica fonte dati tracciabile (API o demo dichiarato) */}
      <section
        className="kpi-real-bar"
        aria-label="Indicatori reali da Supabase"
        aria-live="polite"
      >
        {loading && (
          <div className="kpi-real loading" role="status">
            <span className="skeleton" /> Caricamento KPI reali…
          </div>
        )}
        {!loading && error && (
          <div className="kpi-real error" role="alert">
            API non raggiungibile ({error}) — mostro demo. Avvia backend: `npm --prefix backend run dev` + verifica `curl localhost:3001/api/v1/dashboard/kpi`.
          </div>
        )}
        {!loading && !error && data && !data._empty && (
          <div className="kpi-real ok">
            <span>
              Prenotazioni reali <strong>{formatIT(data.totale_prenotazioni)}</strong>
            </span>
            <span>
              Da garantire <strong>{formatIT(data.totale_da_garantire)}</strong>
            </span>
            <span>
              Fuori TMAX <strong>{formatIT(data.totale_fuori_tmax)}</strong>
              {fuoriTmaxPct != null && (
                <small> ({fuoriTmaxPct.toFixed(1).replace('.', ',')} % su da garantire)</small>
              )}
            </span>
            <small className="kpi-source">Fonte: GET /dashboard/kpi · settimana {settimana || '07-11 OTTOBRE 2024'}</small>
          </div>
        )}
        {!loading && !error && data?._empty && (
          <div className="kpi-real empty" role="status">
            Nessun dato per questa settimana (dati insufficienti — il CSV copre solo 07-11 OTT 2024).
          </div>
        )}
        {!loading && isDemo && !error && (
          <small className="kpi-source">Modalità demo — nessun hardcoded nuovo</small>
        )}
      </section>

      <section className="metric-grid" aria-label="Indicatori principali (demo)">
        {DEMO_METRICS.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </section>
    </>
  );
}
