import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import MetricGrid from './components/MetricGrid.jsx';

// Settimana unica coperta dal CSV — cfr. AGENTS.md §3.
// Quando arriveranno nuovi CSV (Fase 5), diventerà un filtro UI.
const SETTIMANA_DEFAULT = '07-11 OTTOBRE 2024';

const reassigned = [
  ['✚', 'cardio', 'Ecocardiogramma', 'Ospedale San Paolo · Bari', 'oggi, 11:42', 'Confermato', 'success'],
  ['◉', 'eye', 'Visita oculistica', 'Policlinico · Foggia', 'oggi, 11:18', 'In attesa', 'pending'],
  ['◇', 'bone', 'Risonanza magnetica', 'Vito Fazzi · Lecce', 'oggi, 10:56', 'Confermato', 'success'],
  ['⊕', 'lungs', 'Visita pneumologica', 'SS. Annunziata · Taranto', 'oggi, 10:31', 'Scaduto', 'expired'],
];

const territory = [
  ['BA', 'Bari', '42 gg', 61],
  ['LE', 'Lecce', '38 gg', 68],
  ['FG', 'Foggia', '31 gg', 82],
  ['TA', 'Taranto', '29 gg', 86],
];

function RecoveryChart() {
  return <article className="panel chart-panel"><div className="panel-heading"><div><p className="section-kicker">Settimana disponibile · demo</p><h3>Slot recuperati dalla rete</h3></div><select aria-label="Intervallo grafico" defaultValue="30"><option value="30">Ultimi 30 giorni</option><option value="7">Ultimi 7 giorni</option></select></div><div className="legend"><span><i className="legend-green" />Recuperati</span><span><i className="legend-gray" />Slot disponibili</span></div><div className="big-chart"><div className="y-axis"><span>160</span><span>120</span><span>80</span><span>40</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 650 180" preserveAspectRatio="none" aria-label="Grafico demo slot recuperati"><path className="area" d="M0 146 C40 138 53 152 78 127 S120 115 145 122 S185 108 205 112 S240 84 270 102 S305 90 330 82 S360 105 385 73 S420 80 440 63 S472 83 495 54 S530 69 552 38 S600 54 650 20 V180 H0Z" /><path className="curve" d="M0 146 C40 138 53 152 78 127 S120 115 145 122 S185 108 205 112 S240 84 270 102 S305 90 330 82 S360 105 385 73 S420 80 440 63 S472 83 495 54 S530 69 552 38 S600 54 650 20" /></svg><div className="x-axis"><span>02 set</span><span>08 set</span><span>14 set</span><span>20 set</span><span>26 set</span><span>01 ott</span></div></div></div></article>;
}

function ReassignmentQueue() {
  return <article className="panel queue-panel"><div className="panel-heading"><div><p className="section-kicker">Azioni recenti · demo</p><h3>Ultime riassegnazioni</h3></div><button className="text-button" type="button">Vedi tutte →</button></div><div className="queue-list">{reassigned.map(([icon, kind, title, location, time, state, stateClass]) => <div className="queue-item" key={title}><span className={`service-icon ${kind}`}>{icon}</span><div><strong>{title}</strong><small>{location}</small></div><span className="queue-time">{time}</span><span className={`queue-state ${stateClass}`}>{state}</span></div>)}</div></article>;
}

function TerritoryPanel() {
  return <article className="panel territory-panel" id="territorio"><div className="panel-heading"><div><p className="section-kicker">Mappa delle criticità · demo</p><h3>La domanda dove serve</h3></div><button className="text-button" type="button">Esporta CSV ↓</button></div><div className="territory-layout"><div className="puglia-map" aria-label="Mappa stilizzata della Puglia"><span className="map-shape" />{['p1', 'p2', 'p3', 'p4', 'p5'].map((pin) => <i className={`pin ${pin}`} key={pin} />)}<span className="map-label l1">FG</span><span className="map-label l2">BA</span><span className="map-label l3">BR</span><span className="map-label l4">LE</span><span className="map-label l5">TA</span></div><div className="territory-table"><div className="table-row table-header"><span>Zona / ASL</span><span>Attesa media</span><span>Utilizzo</span></div>{territory.map(([code, name, wait, usage]) => <div className="table-row" key={code}><span><b>{code}</b> {name}</span><span>{wait}</span><span><em className={`bar ${usage > 80 ? 'ok' : ''}`}><i style={{ width: `${usage}%` }} /></em> {usage}%</span></div>)}</div></div></article>;
}

function Simulator() {
  const [hours, setHours] = useState(8);
  const [applied, setApplied] = useState(false);
  const savedDays = Math.round(hours * 0.85);
  return <article className="panel simulator-panel" id="simulatore"><div className="panel-heading"><div><p className="section-kicker">Proiezione demo</p><h3>Sposta risorse</h3></div><span className="simulator-badge">Scenario 01</span></div><p className="simulator-copy">Sposta ore di specialista da una zona con capacità inutilizzata verso una zona in sofferenza.</p><label className="field-label" htmlFor="from">Da</label><select id="from" defaultValue="ba"><option value="ba">BA · Bari (61% utilizzo)</option><option value="le">LE · Lecce (68% utilizzo)</option></select><label className="field-label" htmlFor="to">A</label><select id="to" defaultValue="fg"><option value="fg">FG · Foggia (42 gg attesa)</option><option value="ba">BA · Bari (42 gg attesa)</option></select><div className="range-label"><span>Ore settimanali</span><strong>{hours} ore</strong></div><input id="hours" type="range" min="2" max="20" value={hours} onChange={(event) => setHours(Number(event.target.value))} /><div className="simulation-result"><span>Nuova attesa stimata</span><strong>{42 - savedDays} giorni <small>↓ {savedDays} giorni</small></strong></div><button className="primary-button" type="button" onClick={() => setApplied(true)}>{applied ? 'Scenario applicato' : 'Applica scenario'} <span>{applied ? '✓' : '→'}</span></button></article>;
}

function App() {
  const [refreshed, setRefreshed] = useState(false);
  return <div className="app-shell"><Sidebar /><main className="main-content" id="overview"><Topbar /><section className="intro-row"><div><p className="section-kicker">Giovedì 01 ottobre 2026</p><h2>La rete sta recuperando tempo.</h2><p className="subline">Ogni slot riaperto è una visita anticipata per un cittadino.</p></div><button className="outline-button" type="button" onClick={() => setRefreshed(true)}>{refreshed ? '✓ ' : '↻ '}<span>{refreshed ? 'Dati aggiornati' : 'Aggiorna dati'}</span></button></section><MetricGrid settimana={SETTIMANA_DEFAULT} /><section className="content-grid"><RecoveryChart /><ReassignmentQueue /></section><section className="bottom-grid"><TerritoryPanel /><Simulator /></section><footer><span>ReCUPera · sistema di ottimizzazione delle liste d'attesa</span><span>Fonte: Monitoraggio tempi di attesa · Regione Puglia</span></footer></main></div>;
}

export default App;
