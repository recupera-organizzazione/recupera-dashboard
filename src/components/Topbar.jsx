import { STR, salutoPerOra } from '../lib/strings.js';

// Saluto coerente con l'ora reale (prima era sempre "Buongiorno") e account
// reale da sessione (prima avatar mock "MR"). Esci revoca la sessione.
export default function Topbar({ username, onLogout }) {
  const who = username || STR.topbar.fallbackWho;
  const initial = who.trim().charAt(0).toUpperCase() || '?';

  return (
    <header className="topbar">
      <div>
        <p className="breadcrumb">
          Regione Puglia <span>/</span> Centro operativo
        </p>
        <h1>
          {salutoPerOra(new Date().getHours())}, {who}
        </h1>
      </div>
      <div className="top-actions">
        <span className="live-label">
          <i /> Live
        </span>
        <button className="icon-button" type="button" aria-label="Notifiche, 3 non lette">
          ♧<b>3</b>
        </button>
        <div className="avatar" aria-label={`Account ${who}`}>
          {initial}
        </div>
        {onLogout && (
          <button className="text-button" type="button" onClick={onLogout}>
            {STR.topbar.logout}
          </button>
        )}
      </div>
    </header>
  );
}
