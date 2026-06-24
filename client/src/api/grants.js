const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// GET /api/grants
export function fetchGrants() {
  return apiFetch('/api/grants');
}

// GET /api/grants/:grantId/report?month=
export function fetchGrantReport(grantId, month) {
  return apiFetch(`/api/grants/${grantId}/report?month=${month}`);
}

// POST /api/grants/:grantId/report/generate?month=
export function generateGrantReport(grantId, month) {
  return apiFetch(`/api/grants/${grantId}/report/generate?month=${month}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/program-report/generate
export function generateProgramReport(params) {
  return apiFetch('/api/program-report/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
