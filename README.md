# recupera-dashboard
Dashboard regionale per gestione CUP — Regione Puglia.

## Cosa?
Modulo frontend + backend per la dashboard amministrativa di cancellazione e gestione delle prenotazioni.
Usa il dataset di "Monitoraggio dei tempi di attesa" per stimare la pressione per ASL/prestazione e ottimizzare la gestione del servizio.

## Come?
Dashboard amministrativa per operatori CUP con:
- KPI di rete (prenotazioni, quota da garantire, quota oltre TMAX),
- serie temporale slot/prenotazioni,
- mappa hotspot per ASL (obiettivo futuro: dettaglio per CAP),
- simulatore "sposta ore di specialista" da zone con capacità a zone in sofferenza.

Target iniziale: Regione Puglia (6 ASL).

## Tech stack del progetto (confermato)

> Decisione: **React web** (non React Native). React Native è stato scartato perché
> la dashboard è un tool admin desktop; Expo/RN-Web aggiungerebbe costo senza benefici.

**Backend:**
- Node.js 22 LTS + Express (alternativa accettata: Fastify)
- Supabase come database (Postgres gestito; niente Postgres locale in Docker)
- Accesso dati: `@supabase/supabase-js` con `service_role` solo lato server (Prisma ammesso solo se puntato al pooler Supabase/Supavisor, non come default)
- Validazione: zod
- Import CSV: `csv-parse` con encoding `latin1/cp1252` → UTF-8, via script con chiave `service_role`
- Struttura: `backend/src/{index.js, routes/, db/supabaseClient.js, scripts/import-csv.js}`

**Frontend:**
- React 18 + Vite + TypeScript
- Data fetching: React Query (TanStack Query)
- Grafici: Recharts
- Mappa: Leaflet + GeoJSON Puglia (i pin CSS attuali in `index.html` sono placeholder)
- Il prototipo attuale (`index.html` + `style.css` + `app.js` vanilla) è il riferimento UI da migrare a componenti (`Dashboard.tsx`, `Territorio.tsx`, `Simulatore.tsx`).

**DevOps / repo:**
- Niente Postgres locale: il DB è il progetto Supabase condiviso (niente servizio `db` in Docker; `docker-compose.yml` al massimo per la sola `api`, opzionale in dev)
- Monorepo: `/backend`, `/frontend`, `/data`, `/supabase` (migrazioni via Supabase CLI)
- `.env` via `dotenv` + `.env.example` versionato con `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (mai committare valori reali)

## Dataset

File: `monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv` (da spostare in `data/`, vedi roadmap).

- Righe: 414 | Encoding reale: `cp1252/latin1` (non UTF-8) | Settimana unica: `07-11 OTTOBRE 2024`, anno 2024
- 6 ASL: `160114=BA, 160115=FG, 160116=LE, 160112=TA, 160113=BT, 160106=BR`
- 69 prestazioni (`DESC_PRESTAZIONE` + `COD_PRESTAZIONE` + `ID_PRESTAZIONE`)
- Colonne: `ASL, ANNO, SETTIMANA_INDICE, ID_PRESTAZIONE, DESC_PRESTAZIONE, COD_PRESTAZIONE, PRENOTAZIONI, PRENOTAZIONI_DAGARANTIRE, PRENOTAZIONI_DAGARANTIRE_B, PRENOTAZIONI_DAGARANTIRE_B_TMAX, PRENOTAZIONI_DAGARANTIRE_D, PRENOTAZIONI_DAGARANTIRE_D_TMAX, PRENOTAZIONI_DAGARANTIRE_P, PRENOTAZIONI_DAGARANTIRE_P_TMAX`
- Classi priorità: `B=Breve (10gg), D=Differita (30/60gg), P=Programmabile (120gg)`; `*_TMAX` = quota oltre il tempo massimo → proxy di criticità/attesa.
- Limiti noti: una sola settimana (niente trend 30gg reali), nessun giorno di attesa reale, nessun CAP, celle vuote (`Mammografia monolaterale`), un `�` in `TC dell'addome superiore`. Vedi `AGENTS.md`.

## Schema DB su Supabase (proposto)

Tabelle create con migration Supabase CLI (`supabase/migrations/`):

- `asl(id CHAR(6) PK, sigla, nome)` — seed 6 righe
- `prestazione(id INT PK, descrizione, codice)`
- `rilevazione_settimanale(id BIGSERIAL PK, asl_id FK, prestazione_id FK, anno, settimana, prenotazioni, da_garantire, b_tot, b_fuori_tmax, d_tot, d_fuori_tmax, p_tot, p_fuori_tmax, UNIQUE(asl_id, prestazione_id, settimana))`
- Vista `kpi_territorio` per hotspot; futura tabella `simulazioni`
- RLS: lettura pubblica/anon solo sulle viste/tabelle di lettura; scritture e import solo via `service_role` dal backend (mai esporre la `service_role` nel frontend).

## Endpoint map (`/api/v1`)

| Metodo | Endpoint | Uso UI |
|---|---|---|
| GET | `/api/health` | stato "Dati aggiornati" |
| GET | `/api/asl` | select Da/A, tabella territorio, pin mappa |
| GET | `/api/prestazioni?q=` | filtri |
| GET | `/api/dashboard/kpi?settimana=` | 4 metric-card (oggi hardcoded) |
| GET | `/api/dashboard/serie?giorni=30&asl=&prestazione=` | chart-panel (oggi SVG finto) |
| GET | `/api/territorio/hotspot?settimana=` | territory-panel tabella + mappa |
| GET | `/api/riassegnazioni?limit=10` | queue-panel (mock in DB finché non c'è gestionale CUP) |
| POST | `/api/simulatori/proiezione {da_asl, a_asl, ore}` | simulator-panel (oggi formula fake `42-value*0.85`) |
| GET | `/api/export.csv?settimana=&asl=` | bottone "Esporta CSV" |
| POST | `/api/admin/import` (multipart CSV) | bottone "Aggiorna dati" |

`attesa_stimata_gg` è un'euristica documentata (es. `base + k * fuori_tmax_pct`), non un dato reale.

## Roadmap

1. **Fase 0 — igiene repo:** spostare CSV in `data/`, convertire UTF-8, `git add`, fix `README`, `package.json` root, `.env.example` con variabili Supabase, `supabase/` init + prima migration (`supabase init`, `supabase migration new`).
2. **Fase 1 — backend letture su Supabase:** tabelle + seed ASL via migration, RLS, script `import:csv` verso Supabase (upsert idempotente), `GET /asl, /prestazioni, /dashboard/kpi, /territorio/hotspot`.
3. **Fase 2 — frontend reale:** Vite+TS, React Query, sostituire mock (`284`, `42gg`, SVG, pin CSS) con fetch; `Esporta CSV`, filtri, stati loading/error/empty.
4. **Fase 3 — simulatore + import:** `POST /simulatori/proiezione` con formula su `fuori_tmax`, `POST /admin/import`.
5. **Fase 4 — territorio:** Leaflet + GeoJSON Puglia; dataset CAP→ASL se si vuole il dettaglio per CAP (oggi non esiste).
6. **Fase 5 — serie storiche:** servono più settimane (oggi 1 sola) per il grafico "ultimi 30 giorni".

## Avvio (target, non ancora implementato)

```bash
# 1. Configura Supabase (una volta)
supabase link --project-ref <ref>   # oppure: supabase init se parte da zero
supabase db push                     # applica supabase/migrations al progetto remoto

# 2. Backend: importa il CSV su Supabase (richiede SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in backend/.env, mai committato)
npm --prefix backend install
npm --prefix backend run import:csv -- ../data/monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv

# 3. Frontend web
npm --prefix frontend install
npm --prefix frontend run dev        # usa VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY solo per letture, oppure base URL della Express API
```

Niente `docker compose up db`: il database è Supabase remoto. Un eventuale `docker-compose.yml` serve solo per la `api` in locale ed è opzionale.

Vedi `AGENTS.md` per vincoli, scope e regole per agenti/contributori.
