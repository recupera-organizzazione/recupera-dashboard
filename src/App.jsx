import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Login from './components/Login.jsx';
import MetricGrid from './components/MetricGrid.jsx';
import { clearToken, getMe, getToken } from './lib/api.js';
import { getExportUrl } from './lib/api.js';
import { queryClient } from './lib/queryClient.js';
import { useAsl, useHotspot, useProiezione, useRiassegnazioni, useSerie } from './hooks/useDashboard.js';
import { STR } from './lib/strings.js';

// Data odierna reale in italiano ("giovedì 1 ottobre 2026"): prima era hardcoded.
function dataOdierna() {
  return new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Settimana unica coperta dal CSV — cfr. AGENTS.md §3.
// Quando arriveranno nuovi CSV (Fase 5), diventerà un filtro UI.
const SETTIMANA_DEFAULT = '07-11 OTTOBRE 2024';

// Dati mock rimossi (Fase 2): ogni pannello legge le API via useDashboard.js.
// Resta demo solo ciò che il dataset non copre (mappa stilizzata, Giorni restituiti).

function RecoveryChart() {
  // Serie reale: 1 sola settimana disponibile → 1 punto + nota, mai trend inventati.
  const { data, isLoading, isError } = useSerie({ giorni: 30 });
  const body = data?.data ?? data;
  const punto = body?.punti?.[0];
  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Prenotazioni registrate</p>
          <h3>Volume della domanda</h3>
        </div>
      </div>
      {isLoading && <p className="panel-note" role="status">Caricamento serie…</p>}
      {isError && <p className="panel-error" role="alert">Serie non disponibile: servizio dati non raggiungibile.</p>}
      {!isLoading && !isError && punto && (
        <div className="serie-reale">
          <strong>{punto.prenotazioni.toLocaleString('it-IT')}</strong>
          <span>prenotazioni · settimana {punto.settimana}</span>
          <small>{body.nota}</small>
        </div>
      )}
      {!isLoading && !isError && !punto && (
        <p className="panel-note" role="status">Nessun punto disponibile per i filtri scelti.</p>
      )}
    </article>
  );
}

function ReassignmentQueue() {
  // Opportunità reali dal proxy fuori-TMAX (ordinate per criticità).
  // Nessun orario/stato paziente: il gestionale CUP non è collegato.
  const { data, isLoading, isError } = useRiassegnazioni(4);
  const rows = data?.data?.rows ?? [];
  const icons = ['✚', '◉', '◇', '⊕'];
  return (
    <article className="panel queue-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Per quota oltre i tempi massimi</p>
          <h3>Dove intervenire prima</h3>
        </div>
      </div>
      {isLoading && <p className="panel-note" role="status">Caricamento criticità…</p>}
      {isError && <p className="panel-error" role="alert">Elenco non disponibile: servizio dati non raggiungibile.</p>}
      {!isLoading && !isError && (
        <div className="queue-list">
          {rows.map((r, i) => (
            <div className="queue-item" key={`${r.asl_id}-${r.prestazione}`}>
              <span className="service-icon cardio">{icons[i % icons.length]}</span>
              <div>
                <strong>{r.prestazione}</strong>
                <small>
                  {r.sigla} · oltre TMAX {r.fuori_tmax_tot.toLocaleString('it-IT')} su{' '}
                  {r.prenotazioni.toLocaleString('it-IT')}
                </small>
              </div>
              <span className="queue-state pending">proxy</span>
            </div>
          ))}
        </div>
      )}
      <p className="panel-note">Proxy di criticità, non riassegnazioni reali: il gestionale CUP non è collegato.</p>
    </article>
  );
}

function TerritoryPanel() {
  // Tabella reale da /territorio/hotspot (attesa stimata + quota oltre TMAX).
  // La mappa resta stilizzata con posizioni indicative: niente coordinate reali.
  const { data, isLoading, isError } = useHotspot(SETTIMANA_DEFAULT);
  const hot = data?.data;
  const rows = Array.isArray(hot) ? hot : [];
  return (
    <article className="panel territory-panel" id="territorio">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Criticità per ASL · dati reali</p>
          <h3>Dove si concentra la domanda</h3>
        </div>
        <a className="text-button" href={getExportUrl({ settimana: SETTIMANA_DEFAULT })}>
          Esporta CSV ↓
        </a>
      </div>
      {isLoading && <p className="panel-note" role="status">Caricamento territorio…</p>}
      {isError && <p className="panel-error" role="alert">Territorio non disponibile: servizio dati non raggiungibile.</p>}
      {!isLoading && !isError && (
        <div className="territory-layout">
          <div className="puglia-map" aria-label="Mappa stilizzata della Puglia, posizioni indicative">
            <span className="map-shape" />
            {['p1', 'p2', 'p3', 'p4', 'p5'].map((pin) => (
              <i className={`pin ${pin}`} key={pin} />
            ))}
            <span className="map-label l1">FG</span>
            <span className="map-label l2">BA</span>
            <span className="map-label l3">BR</span>
            <span className="map-label l4">LE</span>
            <span className="map-label l5">TA</span>
          </div>
          <div className="territory-table">
            <div className="table-row table-header">
              <span>Zona / ASL</span>
              <span>Attesa stimata</span>
              <span>Oltre TMAX</span>
            </div>
            {rows.map((r) => (
              <div className="table-row" key={r.asl_id}>
                <span>
                  <b>{r.sigla}</b> {r.nome.replace(/^ASL /, '')}
                </span>
                <span>{r.attesa_stimata_gg} gg</span>
                <span>
                  <em className={`bar ${r.fuori_tmax_pct <= 0.4 ? 'ok' : ''}`}>
                    <i style={{ width: `${Math.round(r.fuori_tmax_pct * 100)}%` }} />
                  </em>{' '}
                  {Math.round(r.fuori_tmax_pct * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="panel-note map-note">Mappa stilizzata a posizioni indicative · attese stimate con euristica 7+40×quota oltre TMAX.</p>
    </article>
  );
}

function Simulator() {
  // Proiezione reale via POST /simulatori/proiezione (euristica documentata
  // ore×0,85 sull'attesa stimata della ASL di destinazione). Niente più formula locale.
  const [da, setDa] = useState('BA');
  const [a, setA] = useState('FG');
  const [hours, setHours] = useState(8);
  const { data: aslBody } = useAsl();
  const asls = aslBody?.data ?? [];
  const proiezione = useProiezione();
  const result = proiezione.data?.data ?? proiezione.data;

  const daOptions = asls.length ? asls : [{ sigla: 'BA', nome: 'ASL Bari' }];
  const aOptions = asls.length ? asls : [{ sigla: 'FG', nome: 'ASL Foggia' }];

  return (
    <article className="panel simulator-panel" id="simulatore">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Proiezione su dati reali</p>
          <h3>Sposta risorse</h3>
        </div>
      </div>
      <p className="simulator-copy">Sposta ore di specialista da una zona con capacità disponibile verso una zona in difficoltà.</p>
      <label className="field-label" htmlFor="from">Da</label>
      <select id="from" value={da} onChange={(e) => setDa(e.target.value)}>
        {daOptions.map((s) => (
          <option key={s.sigla} value={s.sigla}>{s.sigla} · {s.nome.replace(/^ASL /, '')}</option>
        ))}
      </select>
      <label className="field-label" htmlFor="to">A</label>
      <select id="to" value={a} onChange={(e) => setA(e.target.value)}>
        {aOptions.map((s) => (
          <option key={s.sigla} value={s.sigla}>{s.sigla} · {s.nome.replace(/^ASL /, '')}</option>
        ))}
      </select>
      <div className="range-label"><span>Ore settimanali</span><strong>{hours} ore</strong></div>
      <input id="hours" type="range" min="2" max="20" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      {proiezione.isError && (
        <p className="panel-error" role="alert">
          {(proiezione.error?.cause?.body?.error?.message || proiezione.error?.message) ?? 'Proiezione non riuscita.'}
        </p>
      )}
      <div className="simulation-result">
        <span>Nuova attesa stimata</span>
        {result ? (
          <strong>
            {result.nuova_attesa_stimata_gg} giorni <small>↓ {result.riduzione_stimata_gg} giorni</small>
          </strong>
        ) : (
          <strong>— <small>premi Applica scenario</small></strong>
        )}
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={proiezione.isPending}
        onClick={() => proiezione.mutate({ da_asl: da, a_asl: a, ore: hours })}
      >
        {proiezione.isPending ? 'Calcolo…' : 'Applica scenario'} <span>→</span>
      </button>
      <p className="panel-note sim-hint">Euristica dimostrativa: nuova attesa = attesa stimata − ore×0,85.</p>
    </article>
  );
}

function App() {
  const [refreshed, setRefreshed] = useState(false);
  // Gate di sessione: senza token valido si mostra solo Login.
  // All'avvio, un token esistente viene verificato via GET /auth/me.
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then((me) => {
        setUser(me);
        setChecking(false);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setChecking(false);
      });
  }, []);

  function handleLogout() {
    clearToken();
    queryClient.clear();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="login-screen">
        <div className="login-card" role="status">
          <p>{STR.login.checking}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoggedIn={(me) => setUser(me)} />;
  }

  return <div className="app-shell"><Sidebar /><main className="main-content" id="overview"><Topbar username={user.username} onLogout={handleLogout} /><section className="intro-row"><div><p className="section-kicker">{dataOdierna()}</p><h2>La rete è sotto pressione.</h2><p className="subline">Domanda, tempi massimi e capacità disponibile, per ASL.</p></div><button className="outline-button" type="button" onClick={() => { queryClient.invalidateQueries(); setRefreshed(true); }}>{refreshed ? '✓ ' : '↻ '}<span>{refreshed ? 'Dati aggiornati' : 'Aggiorna dati'}</span></button></section><MetricGrid settimana={SETTIMANA_DEFAULT} /><section className="content-grid"><RecoveryChart /><ReassignmentQueue /></section><section className="bottom-grid"><TerritoryPanel /><Simulator /></section><footer><span>ReCUPera · sistema di ottimizzazione delle liste d'attesa</span><span>Fonte: Monitoraggio tempi di attesa · Regione Puglia</span></footer></main></div>;
}

export default App;
