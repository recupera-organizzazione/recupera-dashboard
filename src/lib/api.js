// Client API per ReCUPera dashboard — Parte 2 data-layer completo
// Copre tutto il contratto AGENTS.md §5.1 (/api/v1, JSON).
// Base URL: VITE_API_BASE (default /api/v1 → usa proxy Vite in dev, cfr. vite.config.js)
// Contratto errori backend: { error: { code, message } } o { error: string }

const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      body?.error?.message || body?.error || body?.message || `Errore HTTP ${res.status}`;
    const code = body?.error?.code || res.status;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message), {
      cause: { code, status: res.status, body },
    });
  }
  return body;
}

export function getHealth() {
  return request('/health');
}

export function getAsl() {
  return request('/asl');
}

export function getPrestazioni(q) {
  return request(`/prestazioni${buildQuery({ q })}`);
}

export function getKpi(settimana) {
  return request(`/dashboard/kpi${buildQuery({ settimana })}`);
}

export function getSerie({ giorni = 30, asl = '', prestazione = '' } = {}) {
  // Nota dataset: 1 sola settimana reale → il backend ritorna
  // 1 punto + nota dati insufficienti, mai 30 punti inventati.
  return request(`/dashboard/serie${buildQuery({ giorni, asl, prestazione })}`);
}

export function getHotspot(settimana) {
  return request(`/territorio/hotspot${buildQuery({ settimana })}`);
}

export function getRiassegnazioni(limit = 10) {
  return request(`/riassegnazioni${buildQuery({ limit })}`);
}

export function postProiezione({ da_asl, a_asl, ore }) {
  // Validazione client allineata a backend/zod + slider App.jsx (ore 2..20, da_asl != a_asl)
  if (!da_asl || !a_asl || ore == null) {
    return Promise.reject(new Error('Parametri mancanti: da_asl, a_asl e ore sono obbligatori'));
  }
  if (da_asl === a_asl) {
    return Promise.reject(new Error('da_asl e a_asl devono essere diversi'));
  }
  const oreNum = Number(ore);
  if (!Number.isFinite(oreNum) || oreNum < 2 || oreNum > 20) {
    return Promise.reject(new Error('ore deve essere tra 2 e 20'));
  }
  return request('/simulatori/proiezione', {
    method: 'POST',
    body: JSON.stringify({ da_asl, a_asl, ore: oreNum }),
  });
}

export function getExportUrl({ settimana = '', asl = '' } = {}) {
  // GET /export.csv riusa gli stessi filtri delle GET JSON + Content-Disposition: attachment
  return `${API_BASE}/export.csv${buildQuery({ settimana, asl })}`;
}

export async function postAdminImport(file) {
  // POST /admin/import multipart — solo admin, mai con ANON key
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/admin/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || body?.error || `Errore HTTP ${res.status}`);
  }
  return res.json();
}

export const apiConfig = { API_BASE };
