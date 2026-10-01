// Client API per ReCUPera dashboard — Parte 1 Shell+KPI
// Base URL configurabile via VITE_API_BASE, fallback a stesso origin /api/v1
// Contratto errori backend: { error: { code, message } } o { error: string }

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

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

export function getKpi(settimana) {
  const qs = settimana ? `?settimana=${encodeURIComponent(settimana)}` : '';
  return request(`/dashboard/kpi${qs}`);
}

export function getHealth() {
  return request('/health');
}

export const apiConfig = { API_BASE };
