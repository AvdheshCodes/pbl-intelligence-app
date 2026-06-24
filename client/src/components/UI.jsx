import { 
  CheckCircle2, AlertTriangle, AlertCircle, XCircle, 
  TrendingUp, TrendingDown, Minus, Loader2, AlertOctagon 
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────

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
    'On Track': 'var(--risk-on-track)',
    'Behind':   'var(--risk-behind)',
    'At Risk':  'var(--risk-at-risk)',
    'Critical': 'var(--risk-critical)',
  }[status] || 'var(--text-muted)';
}

export function utilClass(rate) {
  if (rate >= 0.7) return 'util-good';
  if (rate >= 0.4) return 'util-warn';
  return 'util-low';
}

// ── Risk Badge ─────────────────────────────────────────────────────────────────

const RISK_CFG = {
  'On Track': { cls: 'on-track', Icon: CheckCircle2 },
  'Behind':   { cls: 'behind',   Icon: AlertTriangle },
  'At Risk':  { cls: 'at-risk',  Icon: AlertCircle },
  'Critical': { cls: 'critical', Icon: XCircle },
};

export function RiskBadge({ status, title }) {
  const cfg = RISK_CFG[status] || { cls: 'critical', Icon: XCircle };
  const Icon = cfg.Icon;
  return (
    <span className={`risk-badge ${cfg.cls}`} title={title} aria-label={`Risk: ${status}`}>
      <Icon size={14} strokeWidth={2.5} /> {status}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, Icon, trend, accentColor, iconBg, glowColor, id }) {
  const trendClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  const TrendIcon  = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

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
          <Icon size={20} strokeWidth={2.5} />
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`kpi-trend ${trendClass}`}>
            <TrendIcon size={14} strokeWidth={2.5} /> 
            {Math.abs(trend * 100).toFixed(1)}pp
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
      <span style={{ color: 'var(--risk-on-track)' }} title={`On Track: ${onTrack}`}>
        <CheckCircle2 size={12} strokeWidth={2.5} /> {onTrack}
      </span>
      <span style={{ color: 'var(--risk-behind)'   }} title={`Behind: ${behind}`}>
        <AlertTriangle size={12} strokeWidth={2.5} /> {behind}
      </span>
      <span style={{ color: 'var(--risk-at-risk)'  }} title={`At Risk: ${atRisk}`}>
        <AlertCircle size={12} strokeWidth={2.5} /> {atRisk}
      </span>
      <span style={{ color: 'var(--risk-critical)' }} title={`Critical: ${critical}`}>
        <XCircle size={12} strokeWidth={2.5} /> {critical}
      </span>
    </div>
  );
}

// ── Loading / Error ────────────────────────────────────────────────────────────

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 size={32} className="spinner" style={{ color: 'var(--indigo-light)' }} />
      <span style={{ fontWeight: 500 }}>{message}</span>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="error-state" role="alert">
      <AlertOctagon size={18} strokeWidth={2.5} />
      <span>{message}</span>
    </div>
  );
}
