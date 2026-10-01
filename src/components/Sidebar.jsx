export default function Sidebar() {
  return (
    <aside className="sidebar">
      <a className="brand" href="/">
        <span className="brand-mark">↗</span>
        <span>reCUPera</span>
      </a>
      <p className="eyebrow">Centro operativo</p>
      <nav>
        <a className="nav-item active" href="#overview">
          <span>◒</span> Panoramica
        </a>
        <a className="nav-item" href="#territorio">
          <span>⌖</span> Territorio
        </a>
        <a className="nav-item" href="#simulatore">
          <span>↝</span> Simulatore
        </a>
        {/* TODO Parte 2-6: sostituire con rotta reale quando prenotazioni diventa React.
            Link legacy richiesto da AGENTS.md §1: non rimuovere senza placeholder dichiarato. */}
        <a className="nav-item" href="../recupera-prenotazioni/index.html">
          <span>□</span> Prenotazioni
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="status-dot">
          <i /> Dati aggiornati ora
        </div>
        <p className="sidebar-note">
          Monitoraggio tempi di attesa
          <br />
          <strong>Regione Puglia</strong>
        </p>
        <p className="data-note">Dataset sintetico · demo</p>
      </div>
    </aside>
  );
}
