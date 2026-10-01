# AGENTS.md — Guida operativa per agenti (recupera-dashboard)

Questo file definisce **scope, limiti e regole** per qualsiasi agente/contributore che lavora su questo repo.
Il `README.md` è la fonte per stack e roadmap; qui ci sono i vincoli che impediscono di rompere il progetto.

## 0. Prima di qualsiasi cosa: `git pull`

Altri team lavorano sugli stessi repo. **Prima di leggere, modificare o eseguire qualunque cosa**, aggiorna il repo:

```bash
git pull --ff-only
```

- Se il pull fallisce (modifiche locali o storie divergenti), fermati e chiedi all'utente: non usare `reset`, `stash` o `push --force` di tua iniziativa.
- Ripeti il pull prima di ogni commit/push, così lavori sempre sull'ultima versione.

## 1. Contesto e stato reale (non fidarti dei mock)

- Repo: prototipo statico (`index.html`, `style.css`, `app.js` vanilla). **Non esiste ancora** `backend/`, `frontend/`, `package.json`, `supabase/`.
- Il CSV `monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv` è **untracked** (`git status` mostra `??`) e non è mai importato né usato dalla UI.
- Tutta la UI è **mock**: KPI `284 / 1.426 / 78,6% / 3`, tabella `BA 42gg, LE 38gg…`, grafico SVG, pin mappa CSS, formula `app.js:8` (`42 - value*0.85`). Non citarli come dati reali. Non hardcodare nuovi numeri: ogni valore deve venire da API o essere etichettato `demo`.
- Link rotto noto: `index.html:21` punta a `../reCUPera-prenotazioni/index.html` (repo esterno). Non rimuovere senza sostituirlo con rotta reale o placeholder dichiarato.

## 2. Decisioni stack vincolanti

1. **Frontend = React web (Vite + TS). React Native è rifiutato** (decisione utente esplicita). Non proporre/scaffoldare Expo/RN salvo richiesta contraria.
2. **Database = Supabase (Postgres gestito). Niente Postgres locale in Docker.** Non creare un servizio `db` in `docker-compose.yml`, non usare SQLite come soluzione finale (ok solo per spike locale, mai committato come default). Non introdurre Django/Rails/Laravel.
3. **Backend = Node.js 22 + Express (Fastify solo se motivato) sopra Supabase** via `@supabase/supabase-js` (chiave `service_role` solo lato server). Prisma è ammesso solo se puntato al pooler Supabase/Supavisor — il default è `supabase-js` + migrazioni SQL via Supabase CLI.
4. Monorepo: `/backend`, `/frontend`, `/data`, `/supabase` (migrazioni via Supabase CLI: `supabase/migrations/*.sql` + `seed.sql`). Radice con `.env.example` contenente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (mai valori reali, mai `.env` committato). `docker-compose.yml` solo per la `api` locale ed è opzionale.
5. Librerie UI vincolate: `TanStack Query` per fetch, `Recharts` per grafici, `Leaflet` per mappa. Non aggiungere chart/map lib alternative senza rimuovere quella esistente.

## 3. Limiti del dataset (obbligatori da rispettare)

- File: 414 righe, encoding **`cp1252/latin1` non UTF-8** (fallisce `utf-8-sig`; byte `0x92`). Leggere sempre con `latin1/cp1252` e normalizzare in UTF-8. C'è un `�` in `TC dell'addome superiore`.
- Singola settimana `07-11 OTTOBRE 2024` → **impossibile** produrre trend "ultimi 30 giorni" reali. La serie deve restituire 1 punto + nota `dati insufficienti`, mai inventare 30 punti.
- Colonne `*_TMAX` = prenotazioni con appuntamento **entro** il tempo massimo della classe `B/D/P` (legenda ufficiale `legendamonittempiattesa.ods`). Oltre il tempo massimo = totale classe − `*_TMAX` (vista `kpi_territorio`, migrazione `00003`). Le colonne `b/d/p_fuori_tmax` di `rilevazione_settimanale` hanno un nome storico ma contengono il valore "entro".
- **Fonte dati = Supabase.** Il dataset arriva da dati.puglia.it (API CKAN) tramite la sync del test-server (`public.dataset_fonte`, `public.sincronizza_settimana_dataset`): il backend non legge CSV locali a runtime. Il CSV in `data/` resta solo come archivio.
- **Manca tutto ciò che la UI promette**: giorni di attesa reali, CAP, slot recuperati, tasso di conferma, riassegnazioni. Qualsiasi endpoint su questi deve essere:
  - o calcolato come **euristica documentata** (formula + commento + suffisso `stimato`),
  - o servito da tabella `mock/seed` esplicitamente marcata `demo`.
- Mapping ASL fisso (fonte Min. Salute/HL7): `160106=BR, 160112=TA, 160113=BT, 160114=BA, 160115=FG, 160116=LE`. Non re-derivarlo, mettilo in seed.
- Celle vuote presenti (es. `Mammografia monolaterale` con `,,`) → parser deve trattare `""` come `NULL/0`, mai crashare. Attesi dopo import: 414 righe, 6 ASL, 69 prestazioni (assert nel test di import).

## 4. Scope consentito / vietato

**Consentito (in ordine):** Fase 0 igiene repo → Fase 1 DB+import+GET → Fase 2 frontend fetch → Fase 3 simulatore/export/import → Fase 4 Leaflet → Fase 5 serie storiche (solo se arrivano nuovi CSV).

**Vietato senza approvazione utente:**
- Cambiare stack, ORM, o aggiungere auth/pagamenti/multi-regione.
- Reintrodurre Postgres locale via Docker o puntare Prisma a un DB diverso da Supabase.
- Creare dettaglio per CAP (richiede dataset CAP→ASL/comune oggi assente). Fermarsi ad aggregazione per ASL e dichiararlo.
- Inventare giorni di attesa, coordinate pin, o serie storiche. I pin CSS `.p1..p5` vanno sostituiti solo con coordinate reali o rimossi.
- Committare `node_modules/`, `.env`, dump DB, CSV convertiti giganti senza `data/README.md` con fonte.
- `git commit/push/PR` autonomi: modifica i file, ma committa/pusha solo su richiesta esplicita (cfr. policy git globale).

## 5. Contratti da rispettare

### 5.1 Endpoint (`/api/v1`, JSON, snake o camel coerente)
- `GET /health`, `GET /asl`, `GET /prestazioni?q=`, `GET /dashboard/kpi?settimana=`, `GET /dashboard/serie?…`, `GET /territorio/hotspot?settimana=`, `GET /riassegnazioni?limit=`, `POST /simulatori/proiezione {da_asl, a_asl, ore}`, `GET /export.csv?…`, `POST /admin/import` (multipart).
- Errori: `{ error: { code, message } }` con 4xx/5xx corretti; validazione con `zod`; `POST /simulatori/proiezione` valida `da_asl != a_asl`, `ore 2..20` (come lo slider `app.js`).
- `GET /export.csv` riusa gli stessi filtri delle GET JSON e dichiara `Content-Disposition: attachment`.

### 5.2 DB (Supabase)
Tabelle (migration Supabase CLI, mai edit da dashboard): `asl`, `prestazione`, `rilevazione_settimanale` con `UNIQUE(asl_id, prestazione_id, settimana)`; vista `kpi_territorio`. Import = upsert idempotente via client `service_role` dallo script `import:csv` / `POST /admin/import`. RLS: `SELECT` anon consentito solo su tabelle/viste di lettura; `INSERT/UPDATE` solo `service_role`; mai esporre `SUPABASE_SERVICE_ROLE_KEY` nel frontend (solo `VITE_SUPABASE_ANON_KEY`, e preferibilmente solo via backend Express). Mai cancellare dati senza migrazione.

### 5.3 Frontend
- Ogni `fetch` con `loading / error / empty`. Niente `innerHTML` con dati non sanitizzati (oggi `app.js:10` usa `innerHTML`).
- Sostituire nell'ordine: KPI → tabella territorio → lista riassegnazioni → grafico → simulatore → mappa. Mantenere `style.css` come base (formattare da 1 riga a file leggibile prima di modificarlo).

## 6. Regole di lavoro per agenti

1. **Verifica prima di affermare:** `ls`, `git status`, `head` CSV con encoding corretto, `Read` dei file citati. Non descrivere file mai letti.
2. **Piccoli diff:** un task = pochi file; non scaffoldare intero monorepo in un colpo solo senza piano. Aggiorna questo file e `README.md` se cambi contratti.
3. **Encoding e path:** mai assumere UTF-8 per il CSV; mai assumere `data/` esista finché non la crei; il CSV è in radice e untracked — ogni piano deve includerne lo spostamento in `data/`.
4. **Test minimi prima di dire "fatto":** `supabase status` / `supabase db diff` (no `docker compose` con db locale, no `prisma migrate` sul default), `import:csv` su copia (assert 414/6/69), `curl` su ogni endpoint nuovo, `npm run build` frontend. Riporta comandi + output.
5. **Accessibilità/i18n:** UI in italiano, `aria-label` su grafici/mappe come gli attuali, mantieni `lang="it"`.
6. **Cosa non toccare:** ` .git/`, segreti, il repo esterno `reCUPera-prenotazioni`.

## 7. Definizione di "fatto" per i prossimi task

- Fase 0: CSV in `data/` UTF-8 + `data/README.md`, migration Supabase in `supabase/migrations/` applicata (`supabase db push`), `.env.example` con `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (senza valori reali), `README` allineato.
- Fase 1: `import:csv` idempotente verso Supabase + `GET /asl, /prestazioni, /dashboard/kpi, /territorio/hotspot` con dati reali (verificati via `curl` contro totali noti: BA 19.370, FG 10.042, LE 7.754, TA 7.113, BT 5.607, BR 4.686).
- Fase 2+: zero numeri hardcoded in UI; ogni "gg", "%", pin con sorgente tracciabile (API o `demo` dichiarato).
