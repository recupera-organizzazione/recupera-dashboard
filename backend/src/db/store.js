import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import { supabase } from './supabaseClient.js';

// Mapping ASL fisso (Min. Salute/HL7) — non re-derivare (AGENTS.md §3).
export const ASL_META = {
  '160106': { sigla: 'BR', nome: 'ASL Brindisi' },
  '160112': { sigla: 'TA', nome: 'ASL Taranto' },
  '160113': { sigla: 'BT', nome: 'ASL Barletta-Andria-Trani' },
  '160114': { sigla: 'BA', nome: 'ASL Bari' },
  '160115': { sigla: 'FG', nome: 'ASL Foggia' },
  '160116': { sigla: 'LE', nome: 'ASL Lecce' },
};

export const SETTIMANA_DEFAULT = '07-11 OTTOBRE 2024';

// attesa_stimata_gg = EURISTICA documentata (non dato reale):
// base 7gg + 40 * quota oltre TMAX. Cfr. vista kpi_territorio nella migration.
export function attesaStimata(fuoriTmax, daGarantire) {
  if (!daGarantire) return 7;
  return Math.round(7 + 40 * (fuoriTmax / daGarantire));
}

const toInt = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (s === '') return 0; // celle vuote → 0/NULL, mai crashare
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
};

function csvPath() {
  if (process.env.CSV_PATH) return path.resolve(process.cwd(), process.env.CSV_PATH);
  const here = path.dirname(fileURLToPath(import.meta.url));
  // backend/src/db → repo/data/…
  return path.resolve(here, '../../../data/monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv');
}

let csvCache = null;

// Decodifica robusta: il CSV originale è cp1252 (byte 0x92 = ’), la copia in
// data/ è normalizzata UTF-8. Prova UTF-8 stretto, altrimenti win1252 via iconv.
export function decodeCsvBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return iconv.decode(buf, 'win1252');
  }
}

// Legge data/*.csv (UTF-8) o l'originale in radice (cp1252).
export function loadCsvRows() {
  if (csvCache) return csvCache;
  const p = csvPath();
  const fallbackRoot = path.resolve(process.cwd(), '../monitoraggio-tempi-di-attesa-07_11-ottobre-2024.csv');
  const file = fs.existsSync(p) ? p : fallbackRoot;
  const raw = fs.readFileSync(file); // Buffer
  const text = decodeCsvBuffer(raw);
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  csvCache = records.map((r) => {
    const bTmax = toInt(r.PRENOTAZIONI_DAGARANTIRE_B_TMAX);
    const dTmax = toInt(r.PRENOTAZIONI_DAGARANTIRE_D_TMAX);
    const pTmax = toInt(r.PRENOTAZIONI_DAGARANTIRE_P_TMAX);
    const daGarantire = toInt(r.PRENOTAZIONI_DAGARANTIRE);
    return {
      asl_id: String(r.ASL).trim(),
      anno: toInt(r.ANNO),
      settimana: String(r.SETTIMANA_INDICE || '').trim(),
      id_prestazione: String(r.ID_PRESTAZIONE || '').trim() === '' ? null : toInt(r.ID_PRESTAZIONE),
      descrizione: String(r.DESC_PRESTAZIONE || '').trim(),
      codice: String(r.COD_PRESTAZIONE || '').trim() === '' ? null : String(r.COD_PRESTAZIONE).trim(),
      prenotazioni: toInt(r.PRENOTAZIONI),
      da_garantire: daGarantire,
      b_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_B),
      b_fuori_tmax: bTmax,
      d_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_D),
      d_fuori_tmax: dTmax,
      p_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_P),
      p_fuori_tmax: pTmax,
      fuori_tmax_tot: bTmax + dTmax + pTmax,
    };
  });
  return csvCache;
}

// Aggregazione per ASL (stessa logica della vista kpi_territorio).
export function aggregateByAsl(rows, settimana) {
  const filtered = settimana ? rows.filter((r) => r.settimana === settimana) : rows;
  const map = new Map();
  for (const r of filtered) {
    const meta = ASL_META[r.asl_id] || { sigla: r.asl_id, nome: r.asl_id };
    if (!map.has(r.asl_id)) {
      map.set(r.asl_id, {
        asl_id: r.asl_id, sigla: meta.sigla, nome: meta.nome,
        settimana: settimana || r.settimana, anno: r.anno,
        prenotazioni: 0, da_garantire: 0, fuori_tmax_tot: 0,
      });
    }
    const a = map.get(r.asl_id);
    a.prenotazioni += r.prenotazioni;
    a.da_garantire += r.da_garantire;
    a.fuori_tmax_tot += r.fuori_tmax_tot;
  }
  return [...map.values()].map((a) => {
    const pct = a.da_garantire ? a.fuori_tmax_tot / a.da_garantire : 0;
    return { ...a, fuori_tmax_pct: pct, attesa_stimata_gg: attesaStimata(a.fuori_tmax_tot, a.da_garantire) };
  }).sort((x, y) => y.fuori_tmax_tot - x.fuori_tmax_tot);
}

// ── Letture: Supabase se configurato, altrimenti fallback CSV ────────────────

async function trySupabase(fn, fallback) {
  if (!supabase) return fallback();
  try {
    return await fn();
  } catch {
    return fallback();
  }
}

export async function listAsl() {
  return trySupabase(async () => {
    const { data, error } = await supabase.from('asl').select('*').order('sigla');
    if (error) throw error;
    return { rows: data, fonte: 'supabase' };
  }, () => {
    const rows = Object.entries(ASL_META).map(([id, m]) => ({ id, sigla: m.sigla, nome: m.nome }));
    return { rows, fonte: 'csv' };
  });
}

export async function listPrestazioni(q) {
  return trySupabase(async () => {
    let query = supabase.from('prestazione').select('id, id_prestazione, descrizione, codice').order('descrizione').limit(200);
    if (q) query = query.ilike('descrizione', `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { rows: data, fonte: 'supabase' };
  }, () => {
    const rows = loadCsvRows();
    const seen = new Map();
    for (const r of rows) {
      if (!seen.has(r.descrizione)) {
        seen.set(r.descrizione, { id_prestazione: r.id_prestazione, descrizione: r.descrizione, codice: r.codice });
      }
    }
    let out = [...seen.values()];
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter((p) => p.descrizione.toLowerCase().includes(needle));
    }
    return { rows: out.slice(0, 200), fonte: 'csv' };
  });
}

export async function getHotspot(settimana = SETTIMANA_DEFAULT) {
  return trySupabase(async () => {
    const { data, error } = await supabase.from('kpi_territorio').select('*').eq('settimana', settimana);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('settimana non trovata su Supabase');
    return { rows: data, fonte: 'supabase', settimana };
  }, () => {
    const rows = aggregateByAsl(loadCsvRows(), settimana);
    return { rows, fonte: 'csv', settimana };
  });
}

export async function getKpi(settimana = SETTIMANA_DEFAULT) {
  const { rows, fonte } = await getHotspot(settimana);
  const prenotazioni = rows.reduce((s, r) => s + r.prenotazioni, 0);
  const daGarantire = rows.reduce((s, r) => s + r.da_garantire, 0);
  const fuoriTmax = rows.reduce((s, r) => s + r.fuori_tmax_tot, 0);
  const zonePressione = rows.filter((r) => r.da_garantire > 0 && r.fuori_tmax_tot / r.da_garantire > 0.5).length;
  // Blocco cancellazioni: dati reali dal gestionale quando Supabase è
  // configurato (sostituisce i mock "slot recuperati / tasso di conferma").
  const canc = await getCancellazioni({});
  return {
    settimana,
    fonte,
    prenotazioni,
    da_garantire: daGarantire,
    fuori_tmax_tot: fuoriTmax,
    fuori_tmax_pct: daGarantire ? fuoriTmax / daGarantire : 0,
    zone_sotto_pressione_stimate: zonePressione,
    nota: 'fuori_tmax = proxy di pressione (classi B/D/P oltre tempo max); attese in gg solo come attesa_stimata_gg (euristica 7+40*pct)',
    cancellazioni: canc.disponibile ? {
      disponibile: true,
      periodo: canc.periodo,
      totale_cancellate: canc.totale_cancellate,
      tasso_cancellazione_pct: canc.tasso_cancellazione_pct,
      slot_recuperati_riallocati: canc.slot_recuperati_riallocati,
    } : { disponibile: false, nota: canc.nota },
  };
}

// Cancellazioni dal gestionale prenotazioni (tabelle appointments /
// cancellation_events, via vista statistiche_cancellazioni).
// Dati reali: oggi ~1,6k prenotazioni/giorno e 0 cancellazioni registrate —
// l'endpoint riporta gli zeri onestamente, non li inventa. Senza Supabase:
// { disponibile: false } (stato "empty" in UI, mai stima).
export async function getCancellazioni({ da, a, specialty_id, facility_id } = {}) {
  const oggiISO = new Date().toISOString().slice(0, 10);
  const aISO = a || oggiISO;
  const shiftDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daISO = da || shiftDays(aISO, -29);
  const periodo = { da: daISO, a: aISO };
  if (!supabase) {
    return {
      disponibile: false, fonte: 'csv', periodo,
      nota: 'gestionale prenotazioni non collegato (Supabase non configurato): statistiche cancellazioni non disponibili, mai stimate',
    };
  }
  let q = supabase.from('statistiche_cancellazioni').select('*')
    .gte('giorno', daISO).lte('giorno', aISO).limit(5000);
  if (specialty_id) q = q.eq('specialty_id', specialty_id);
  if (facility_id) q = q.eq('facility_id', facility_id);
  const { data, error } = await q;
  if (error) throw error;

  // Aggrega per giorno (somma su specialty/facility) e riempi i buchi con 0.
  const byDay = new Map();
  for (const r of data || []) {
    const e = byDay.get(r.giorno) || { giorno: r.giorno, prenotazioni: 0, cancellate: 0, da_riassegnazione: 0 };
    e.prenotazioni += r.prenotazioni;
    e.cancellate += r.cancellate;
    e.da_riassegnazione += r.da_riassegnazione;
    byDay.set(r.giorno, e);
  }
  const serie = [];
  for (let g = daISO; g <= aISO; g = shiftDays(g, 1)) {
    serie.push(byDay.get(g) || { giorno: g, prenotazioni: 0, cancellate: 0, da_riassegnazione: 0 });
  }
  const totalePrenotazioni = serie.reduce((s, r) => s + r.prenotazioni, 0);
  const totaleCancellate = serie.reduce((s, r) => s + r.cancellate, 0);

  // Slot recuperati reali: disdette riassegnate tracciate in cancellation_events.
  const { count: recuperati, error: evErr } = await supabase.from('cancellation_events')
    .select('appointment_id', { count: 'exact', head: true })
    .eq('reallocated', true)
    .gte('cancelled_at', daISO)
    .lt('cancelled_at', shiftDays(aISO, 1));
  if (evErr) throw evErr;

  return {
    disponibile: true,
    fonte: 'supabase',
    periodo,
    filtri: { specialty_id: specialty_id || null, facility_id: facility_id || null },
    totale_prenotazioni: totalePrenotazioni,
    totale_cancellate: totaleCancellate,
    tasso_cancellazione_pct: totalePrenotazioni ? totaleCancellate / totalePrenotazioni : 0,
    slot_recuperati_riallocati: recuperati ?? 0,
    serie,
    nota: totaleCancellate === 0
      ? 'nessuna cancellazione registrata nel periodo (dati reali dal gestionale, non stima)'
      : 'dati reali dal gestionale prenotazioni (appointments/cancellation_events)',
  };
}

// Serie storica: con 1 sola settimana restituisce 1 punto + nota dati insufficienti. Mai inventare punti.
export async function getSerie({ settimana = SETTIMANA_DEFAULT, asl, prestazione } = {}) {
  const rows = loadCsvRows().filter((r) =>
    (!settimana || r.settimana === settimana) &&
    (!asl || r.asl_id === asl || (ASL_META[r.asl_id] && ASL_META[r.asl_id].sigla.toLowerCase() === String(asl).toLowerCase())) &&
    (!prestazione || r.descrizione.toLowerCase().includes(String(prestazione).toLowerCase())),
  );
  const byWeek = new Map();
  for (const r of rows) {
    byWeek.set(r.settimana, (byWeek.get(r.settimana) || 0) + r.prenotazioni);
  }
  const punti = [...byWeek.entries()].map(([s, totale]) => ({ settimana: s, prenotazioni: totale }));
  return {
    punti,
    nota: 'dati insufficienti: una sola settimana disponibile (07-11 OTTOBRE 2024), trend 30gg non producibile',
    fonte: supabase ? 'supabase+csv' : 'csv',
  };
}

// Riassegnazioni: nessun gestionale CUP reale → opportunità derivate dal proxy
// fuori_tmax (top asl×prestazione per quota oltre TMAX), marcate demo.
export async function getRiassegnazioni(limit = 10) {
  const rows = loadCsvRows();
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.asl_id}|${r.descrizione}`;
    if (!byKey.has(k)) byKey.set(k, { asl_id: r.asl_id, prestazione: r.descrizione, fuori_tmax_tot: 0, prenotazioni: 0 });
    const e = byKey.get(k);
    e.fuori_tmax_tot += r.fuori_tmax_tot;
    e.prenotazioni += r.prenotazioni;
  }
  const top = [...byKey.values()].sort((a, b) => b.fuori_tmax_tot - a.fuori_tmax_tot).slice(0, limit)
    .map((e, i) => ({
      id: i + 1,
      ...e,
      sigla: (ASL_META[e.asl_id] || {}).sigla || e.asl_id,
      stato: 'demo',
      fonte: 'proxy_fuori_tmax',
    }));
  return { rows: top, nota: 'demo: nessun gestionale CUP collegato; ordinamento per quota oltre TMAX (proxy di criticità)', fonte: 'csv' };
}

// Simulatore: euristica demo — riduzione = ore * 0.85 (ex formula app.js), applicata
// all'attesa stimata della ASL destinazione. Documentata, non dato reale.
export async function simulate({ da_asl, a_asl, ore }) {
  const norm = (v) => {
    const s = String(v).trim().toUpperCase();
    for (const [id, m] of Object.entries(ASL_META)) {
      if (id === s || m.sigla === s) return { id, ...m };
    }
    return null;
  };
  const da = norm(da_asl);
  const a = norm(a_asl);
  if (!da || !a) throw Object.assign(new Error('ASL sconosciuta (usare id 1601xx o sigla BR/TA/BT/BA/FG/LE)'), { status: 400 });
  const { rows } = await getHotspot(SETTIMANA_DEFAULT);
  const dest = rows.find((r) => r.asl_id === a.id);
  const partenza = dest ? dest.attesa_stimata_gg : 30;
  const riduzione = Math.round(ore * 0.85);
  const nuova = Math.max(1, partenza - riduzione);
  return {
    da_asl: da, a_asl: a, ore,
    attesa_stimata_partenza_gg: partenza,
    riduzione_stimata_gg: riduzione,
    nuova_attesa_stimata_gg: nuova,
    nota: 'euristica demo: nuova_attesa = max(1, attesa_stimata - round(ore*0.85)); attesa_stimata = 7+40*fuori_tmax_pct',
  };
}

export function buildExportCsv(rows, settimana) {
  const header = 'asl_id,sigla,settimana,prenotazioni,da_garantire,fuori_tmax_tot,fuori_tmax_pct,attesa_stimata_gg\n';
  const lines = rows.map((r) =>
    [r.asl_id, r.sigla, `"${settimana}"`, r.prenotazioni, r.da_garantire, r.fuori_tmax_tot, r.fuori_tmax_pct.toFixed(4), r.attesa_stimata_gg].join(','),
  );
  return header + lines.join('\n') + '\n';
}

// Parse CSV caricato via multipart (latin1 → normalizzato). Riusato da /admin/import e dallo script CLI.
export function parseUploadedCsv(buffer) {
  const text = decodeCsvBuffer(buffer);
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  return records.map((r) => ({
    asl_id: String(r.ASL || '').trim(),
    anno: toInt(r.ANNO),
    settimana: String(r.SETTIMANA_INDICE || '').trim(),
    id_prestazione: String(r.ID_PRESTAZIONE ?? '').trim() === '' ? null : toInt(r.ID_PRESTAZIONE),
    descrizione: String(r.DESC_PRESTAZIONE || '').trim(),
    codice: String(r.COD_PRESTAZIONE ?? '').trim() === '' ? null : String(r.COD_PRESTAZIONE).trim(),
    prenotazioni: toInt(r.PRENOTAZIONI),
    da_garantire: toInt(r.PRENOTAZIONI_DAGARANTIRE),
    b_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_B),
    b_fuori_tmax: toInt(r.PRENOTAZIONI_DAGARANTIRE_B_TMAX),
    d_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_D),
    d_fuori_tmax: toInt(r.PRENOTAZIONI_DAGARANTIRE_D_TMAX),
    p_tot: toInt(r.PRENOTAZIONI_DAGARANTIRE_P),
    p_fuori_tmax: toInt(r.PRENOTAZIONI_DAGARANTIRE_P_TMAX),
  }));
}

// Upsert idempotente verso Supabase: prestazioni per descrizione (UNIQUE),
// rilevazioni su UNIQUE(asl_id, prestazione_id, settimana). Richiede service_role.
export async function upsertRows(rows) {
  if (!supabase) throw new Error('Supabase non configurato');
  const byDesc = new Map();
  for (const r of rows) {
    if (!r.descrizione) continue; // descrizione vuota non importabile: scartata, mai crash
    if (!byDesc.has(r.descrizione)) {
      byDesc.set(r.descrizione, { id_prestazione: r.id_prestazione, descrizione: r.descrizione, codice: r.codice });
    }
  }
  const { data: prestUpserted, error: prestErr } = await supabase
    .from('prestazione')
    .upsert([...byDesc.values()], { onConflict: 'descrizione' })
    .select('id, descrizione');
  if (prestErr) throw prestErr;

  const prestIdByDesc = new Map((prestUpserted || []).map((p) => [p.descrizione, p.id]));
  const rilev = [];
  for (const r of rows) {
    const pid = prestIdByDesc.get(r.descrizione);
    if (!r.descrizione || !pid || !r.asl_id || !r.settimana) continue;
    rilev.push({
      asl_id: r.asl_id, prestazione_id: pid, anno: r.anno, settimana: r.settimana,
      prenotazioni: r.prenotazioni, da_garantire: r.da_garantire,
      b_tot: r.b_tot, b_fuori_tmax: r.b_fuori_tmax,
      d_tot: r.d_tot, d_fuori_tmax: r.d_fuori_tmax,
      p_tot: r.p_tot, p_fuori_tmax: r.p_fuori_tmax,
    });
  }
  let scritte = 0;
  for (let i = 0; i < rilev.length; i += 500) {
    const { error } = await supabase.from('rilevazione_settimanale')
      .upsert(rilev.slice(i, i + 500), { onConflict: 'asl_id,prestazione_id,settimana' });
    if (error) throw error;
    scritte += Math.min(500, rilev.length - i);
  }
  return {
    righe_lette: rows.length,
    prestazioni_distinte: byDesc.size,
    asl_distinte: new Set(rows.map((r) => r.asl_id).filter(Boolean)).size,
    rilevazioni_scritte: scritte,
  };
}
