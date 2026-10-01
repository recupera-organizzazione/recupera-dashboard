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

// Card con dati reali quando l'API risponde (cancellazioni dal gestionale +
// zone sotto pressione dal monitoraggio). Offline: DEMO_METRICS storici.
// "Giorni restituiti" resta demo: nessun dato reale disponibile (AGENTS.md §3).
function realMetrics(data) {
  const canc = data.cancellazioni;
  const live = canc?.disponibile === true;
  const conferma = live ? (1 - canc.tasso_cancellazione_pct) * 100 : null;
  return [
    {
      label: 'Slot recuperati',
      value: live ? formatIT(canc.slot_recuperati_riallocati) : '—',
      trend: live ? 'reale' : 'demo',
      note: live ? `disdette riassegnate · ${canc.periodo.da}–${canc.periodo.a}` : 'gestionale non collegato',
      type: 'emphasis',
    },
    DEMO_METRICS[1],
    {
      label: 'Tasso di conferma',
      value: live ? conferma.toFixed(1).replace('.', ',') : '—',
      unit: live ? '%' : '',
      trend: live ? 'reale' : 'demo',
      note: live ? `quota non disdetta · ${canc.periodo.da}–${canc.periodo.a}` : 'gestionale non collegato',
      type: 'confirmation',
    },
    {
      label: 'Zone sotto pressione',
      value: formatIT(data.zone_sotto_pressione_stimate),
      trend: 'reale',
      note: 'oltre il 50% oltre i tempi massimi',
      type: 'pressure',
    },
  ];
}

export default function MetricGrid({ settimana }) {
  const { data, loading, error, fuoriTmaxPct, isDemo } = useKpi(settimana);
  const metrics = !isDemo && data && !data._empty ? realMetrics(data) : DEMO_METRICS;

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
            Servizio dati non raggiungibile ({error}) — mostro i valori dimostrativi. Avvia il backend: `npm --prefix backend run dev` e verifica `curl localhost:3001/api/v1/dashboard/kpi`.
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
            <small className="kpi-source">Fonte: monitoraggio tempi di attesa · settimana {settimana || '07-11 OTTOBRE 2024'}</small>
          </div>
        )}
        {!loading && !error && data?._empty && (
          <div className="kpi-real empty" role="status">
            Nessun dato per questa settimana — i dati disponibili coprono solo la settimana 07–11 OTT 2024.
          </div>
        )}
        {!loading && isDemo && !error && (
          <small className="kpi-source">Modalità demo — nessun hardcoded nuovo</small>
        )}
      </section>

      <section className="metric-grid" aria-label="Indicatori principali">
        {metrics.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </section>
    </>
  );
}
