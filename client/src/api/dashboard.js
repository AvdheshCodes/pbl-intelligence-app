const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// GET /api/dashboard?month=&district=&block=&grade=&subject=
export function fetchDashboard(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== 'All'))
  ).toString();
  return apiFetch(`/api/dashboard${qs ? `?${qs}` : ''}`);
}

// GET /api/dashboard/filters?district=
export function fetchFilters(district = '') {
  const qs = district && district !== 'All' ? `?district=${encodeURIComponent(district)}` : '';
  return apiFetch(`/api/dashboard/filters${qs}`);
}

// GET /api/geographies?month=&district=&block=&grade=&subject=
export function fetchGeographies(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== 'All'))
  ).toString();
  return apiFetch(`/api/geographies${qs ? `?${qs}` : ''}`);
}
