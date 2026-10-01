import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { stringify } from 'csv-stringify/sync';
import { hasServiceRole, hasSupabase } from '../db/supabaseClient.js';
import {
  SETTIMANA_DEFAULT,
  getCancellazioni,
  getHotspot,
  getKpi,
  getRiassegnazioni,
  getSerie,
  listAsl,
  listPrestazioni,
  loadCsvRows,
  parseUploadedCsv,
  simulate,
  upsertRows,
} from '../db/store.js';

const router = express.Router();
// Memory storage: nessun file residuo su disco (funziona anche nei container).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Error shape di contratto: { error: { code, message } } (AGENTS.md §5.1)
const err = (res, status, code, message) => res.status(status).json({ error: { code, message } });

router.get('/health', (_req, res) => {
  let righe = null;
  try { righe = loadCsvRows().length; } catch { /* csv assente in prod Supabase-only */ }
  res.json({ data: { status: 'ok', settimana_default: SETTIMANA_DEFAULT, righe_csv_locale: righe, supabase: hasSupabase } });
});

router.get('/asl', async (_req, res) => {
  try {
    const { rows } = await listAsl();
    res.json({ data: rows });
  } catch (e) { err(res, 500, 'asl_error', e.message); }
});

router.get('/prestazioni', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const { rows } = await listPrestazioni(q || undefined);
    res.json({ data: rows });
  } catch (e) { err(res, 500, 'prestazioni_error', e.message); }
});

router.get('/territorio/hotspot', async (req, res) => {
  try {
    const settimana = typeof req.query.settimana === 'string' ? req.query.settimana : SETTIMANA_DEFAULT;
    const { rows, fonte } = await getHotspot(settimana);
    res.json({ data: rows, settimana, fonte });
  } catch (e) { err(res, 500, 'hotspot_error', e.message); }
});

router.get('/dashboard/kpi', async (req, res) => {
  try {
    const settimana = typeof req.query.settimana === 'string' ? req.query.settimana : SETTIMANA_DEFAULT;
    res.json({ data: await getKpi(settimana) });
  } catch (e) { err(res, 500, 'kpi_error', e.message); }
});

// Serie storica: il dataset ha 1 sola settimana → 1 punto + nota
// "dati insufficienti". Mai inventare punti (AGENTS.md §3).
router.get('/dashboard/serie', async (req, res) => {
  try {
    const giorni = req.query.giorni ? Number(req.query.giorni) : 30;
    const asl = typeof req.query.asl === 'string' ? req.query.asl : undefined;
    const prestazione = typeof req.query.prestazione === 'string' ? req.query.prestazione : undefined;
    const settimana = typeof req.query.settimana === 'string' ? req.query.settimana : SETTIMANA_DEFAULT;
    res.json({ data: await getSerie({ settimana, asl, prestazione }), giorni });
  } catch (e) { err(res, 500, 'serie_error', e.message); }
});

// GET /dashboard/cancellazioni?da=&a=&specialty_id=&facility_id=
// Statistiche reali dal gestionale (appointments/cancellation_events).
// Default: ultimi 30 giorni. Senza Supabase: { disponibile: false }.
// Data ISO reale (il solo pattern \d{4}-\d{2}-\d{2} lascerebbe passare 2026-13-99,
// che Postgres rigetterebbe con 500 invece di 400).
const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isoDate = z.string().refine(isRealDate, 'formato atteso yyyy-mm-dd (data calendario reale)');
const cancellazioniQuery = z.object({
  da: isoDate.optional(),
  a: isoDate.optional(),
  specialty_id: z.string().min(1).optional(),
  facility_id: z.string().min(1).optional(),
})
  .refine((v) => !v.da || !v.a || v.da <= v.a, { message: 'da deve essere <= a' })
  .refine((v) => {
    if (!v.da || !v.a) return true;
    return (new Date(`${v.a}T00:00:00Z`) - new Date(`${v.da}T00:00:00Z`)) / 864e5 <= 366;
  }, { message: 'intervallo massimo 366 giorni' });

router.get('/dashboard/cancellazioni', async (req, res) => {
  const parsed = cancellazioniQuery.safeParse(req.query);
  if (!parsed.success) {
    return err(res, 400, 'validation_error', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  try {
    res.json({ data: await getCancellazioni(parsed.data) });
  } catch (e) { err(res, 500, 'cancellazioni_error', e.message); }
});

// Riassegnazioni: nessun gestionale CUP reale → opportunità derivate dal proxy
// fuori_tmax, marcate demo. Mai dati random/inventati (AGENTS.md §3).
router.get('/riassegnazioni', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    res.json({ data: await getRiassegnazioni(limit) });
  } catch (e) { err(res, 500, 'riassegnazioni_error', e.message); }
});

// POST /simulatori/proiezione — valida da_asl != a_asl, ore 2..20 (come slider UI).
const proiezioneSchema = z.object({
  da_asl: z.string().min(2),
  a_asl: z.string().min(2),
  ore: z.coerce.number().int().min(2).max(20),
}).refine((v) => v.da_asl.trim().toUpperCase() !== v.a_asl.trim().toUpperCase(), {
  message: 'da_asl e a_asl devono essere diversi',
  path: ['a_asl'],
});

router.post('/simulatori/proiezione', async (req, res) => {
  const parsed = proiezioneSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, 'validation_error', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  try {
    res.json({ data: await simulate(parsed.data) });
  } catch (e) { err(res, e.status || 500, 'simulazione_error', e.message); }
});

// GET /export.csv — riusa gli stessi filtri delle GET JSON.
router.get('/export.csv', async (req, res) => {
  try {
    const settimana = typeof req.query.settimana === 'string' ? req.query.settimana : SETTIMANA_DEFAULT;
    const asl = typeof req.query.asl === 'string' ? req.query.asl : undefined;
    const { rows } = await getHotspot(settimana);
    const filtered = asl
      ? rows.filter((r) => r.asl_id === asl || r.sigla.toLowerCase() === asl.toLowerCase())
      : rows;
    const csv = stringify(filtered.map((r) => ({
      asl_id: r.asl_id,
      sigla: r.sigla,
      settimana,
      prenotazioni: r.prenotazioni,
      da_garantire: r.da_garantire,
      fuori_tmax_tot: r.fuori_tmax_tot,
      fuori_tmax_pct: Number(r.fuori_tmax_pct.toFixed(4)),
      attesa_stimata_gg: r.attesa_stimata_gg,
    })), { header: true, delimiter: ',' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="export_${settimana}.csv"`);
    res.send(csv);
  } catch (e) { err(res, 500, 'export_error', e.message); }
});

// POST /admin/import (multipart name=file) — upsert idempotente via service_role;
// senza chiavi: dry-run di validazione sui conteggi noti (414/6/69).
router.post('/admin/import', upload.single('file'), async (req, res) => {
  if (!req.file) return err(res, 400, 'validation_error', 'campo file mancante (multipart name=file)');
  try {
    const rows = parseUploadedCsv(req.file.buffer);
    const asls = new Set(rows.map((r) => r.asl_id).filter(Boolean));
    const prest = new Set(rows.map((r) => r.descrizione).filter(Boolean));
    if (!hasServiceRole) {
      return res.json({ data: { dry_run: true, righe: rows.length, asl_distinte: asls.size, prestazioni_distinte: prest.size, nota: 'Supabase non configurato: nessuna scrittura, solo validazione' } });
    }
    res.json({ data: { dry_run: false, ...(await upsertRows(rows)) } });
  } catch (e) { err(res, 500, 'import_error', e.message); }
});

export default router;
