import { Check, Minus, AlertCircle, Loader2 } from 'lucide-react';

export function pct(rate, d = 1) {
  if (rate == null || isNaN(rate)) return '—';
  return `${(Number(rate) * 100).toFixed(d)}%`;
}

export function fmt(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('en-IN');
}

export function getRiskColor(status) {
  return {
    'On Track': 'var(--status-good)',
    'Behind':   'var(--status-warn)',
    'At Risk':  'var(--status-risk)',
    'Critical': 'var(--status-crit)',
  }[status] || 'var(--text-muted)';
}

export function utilClass(rate) {
  if (rate >= 0.7) return 'status-good';
  if (rate >= 0.4) return 'status-warn';
  return 'status-crit';
}

// ── Risk Badge (Table) ────────────────────────────────────────────────────────
export function RiskBadge({ status }) {
  if (status === 'On Track') {
    return <span className="status-cell status-good"><Check size={14} /> On Track</span>;
  }
  if (status === 'Behind') {
    return <span className="status-cell status-warn"><Minus size={14} strokeWidth={3} /> Behind</span>;
  }
  if (status === 'At Risk') {
    return <span className="status-cell status-risk">At Risk</span>;
  }
  return <span className="status-cell status-crit">Critical</span>;
}

// ── Status Icon (KPI Card) ────────────────────────────────────────────────────
export function StatusIcon({ status }) {
  if (status === 'On Track') return <Check color="var(--status-good)" size={20} />;
  if (status === 'Behind') return <Minus color="var(--status-warn)" size={20} strokeWidth={3} />;
  if (status === 'At Risk') return <AlertCircle color="var(--status-risk)" size={20} />;
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--status-crit)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-crit)', fontWeight: 600, fontSize: 14 }}>
      !
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, trend, status, progress, id }) {
  return (
    <div id={id} className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-bottom">
        <div className="kpi-value">{value}</div>
        
        {trend !== undefined && trend !== null && (
          <div className={`kpi-status ${trend > 0 ? 'good' : trend < 0 ? 'crit' : ''}`}>
            {trend > 0 ? '↗' : trend < 0 ? '↘' : ''} {Math.abs(trend * 100).toFixed(1)}%
          </div>
        )}
        
        {status && <StatusIcon status={status} />}
        
        {progress !== undefined && (
          <div className="kpi-progress">
            <div className="kpi-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading / Error ────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 64, color: 'var(--text-secondary)' }}>
      <Loader2 size={24} className="spinner" style={{ marginBottom: 16 }} />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div style={{ background: '#fdf2f2', border: '1px solid #f5c6c6', color: 'var(--status-crit)', padding: '16px 20px', borderRadius: 'var(--radius-xs)', marginBottom: 24, fontSize: 13 }}>
      <strong>Error:</strong> {message}
    </div>
  );
}
