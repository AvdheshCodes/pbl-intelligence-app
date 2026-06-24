// ── Formatters ────────────────────────────────────────────────────────────────

/** Format a 0.0–1.0 rate as "72.3%" */
export function pct(rate, d = 1) {
  if (rate == null || isNaN(rate)) return '—';
  return `${(Number(rate) * 100).toFixed(d)}%`;
}

/** Format a number with Indian locale commas */
export function fmt(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('en-IN');
}

/** CSS variable string for a risk status */
export function getRiskColor(status) {
  return {
    'On Track': 'var(--risk-on-track)',
    'Behind':   'var(--risk-behind)',
    'At Risk':  'var(--risk-at-risk)',
    'Critical': 'var(--risk-critical)',
  }[status] || 'var(--text-muted)';
}

/** Utility-rate colour class */
export function utilClass(rate) {
  if (rate >= 0.7) return 'util-good';
  if (rate >= 0.4) return 'util-warn';
  return 'util-low';
}

// ── Risk Badge ─────────────────────────────────────────────────────────────────

const RISK_CFG = {
  'On Track': { cls: 'on-track', dot: '●' },
  'Behind':   { cls: 'behind',   dot: '◆' },
  'At Risk':  { cls: 'at-risk',  dot: '▲' },
  'Critical': { cls: 'critical', dot: '✕' },
};

export function RiskBadge({ status, title }) {
  const cfg = RISK_CFG[status] || { cls: 'critical', dot: '?' };
  return (
    <span className={`risk-badge ${cfg.cls}`} title={title} aria-label={`Risk: ${status}`}>
      {cfg.dot} {status}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, icon, trend, accentColor, iconBg, glowColor, id }) {
  const trendClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  const trendIcon  = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';

  return (
    <div
      id={id}
      className="kpi-card"
      style={{
        '--accent': accentColor || 'var(--indigo)',
        '--glow':   glowColor   || 'var(--indigo-glow)',
      }}
    >
      <div className="kpi-icon-wrap">
        <div className="kpi-icon" style={{ background: iconBg || 'var(--indigo-dim)' }}>
          {icon}
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`kpi-trend ${trendClass}`}>
            {trendIcon} {Math.abs(trend * 100).toFixed(1)}pp
          </span>
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────────

export function ProgressBar({ value, color }) {
  const w = Math.min(100, Math.max(0, (value || 0) * 100));
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${w}%`, background: color || 'var(--indigo)' }} />
    </div>
  );
}

// ── Risk Distribution ──────────────────────────────────────────────────────────

export function RiskDist({ d }) {
  const { onTrack = 0, behind = 0, atRisk = 0, critical = 0 } = d || {};
  return (
    <div className="risk-dist" aria-label="Risk distribution">
      <span style={{ color: 'var(--risk-on-track)' }} title={`On Track: ${onTrack}`}>● {onTrack}</span>
      <span style={{ color: 'var(--risk-behind)'   }} title={`Behind: ${behind}`}>◆ {behind}</span>
      <span style={{ color: 'var(--risk-at-risk)'  }} title={`At Risk: ${atRisk}`}>▲ {atRisk}</span>
      <span style={{ color: 'var(--risk-critical)' }} title={`Critical: ${critical}`}>✕ {critical}</span>
    </div>
  );
}

// ── Loading / Error ────────────────────────────────────────────────────────────

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" style={{ color: 'var(--indigo-light)' }} />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="error-state" role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  );
}
