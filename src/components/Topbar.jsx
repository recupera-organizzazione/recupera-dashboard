export default function Topbar() {
  return (
    <header className="topbar">
      <div>
        <p className="breadcrumb">
          Regione Puglia <span>/</span> Centro operativo
        </p>
        <h1>Buongiorno, operatore</h1>
      </div>
      <div className="top-actions">
        <span className="live-label">
          <i /> Live
        </span>
        <button className="icon-button" type="button" aria-label="Notifiche, 3 non lette">
          ♧<b>3</b>
        </button>
        <div className="avatar" aria-label="Operatore M R">
          MR
        </div>
      </div>
    </header>
  );
}
