import { useState, useEffect } from 'react';
import { 
  BarChart3, Wallet, Flag, Image as ImageIcon, Sparkles, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { fetchGrants, fetchGrantReport, generateGrantReport } from '../api/grants';
import { RiskBadge, LoadingState, ErrorState, pct, fmt, utilClass } from '../components/UI';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const MONTH_LABELS = { '2025-07': 'July 2025', '2025-08': 'August 2025', '2025-09': 'September 2025' };

export default function GrantReport() {
  const [grants, setGrants] = useState([]);
  const [selGrant, setSelGrant] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [availMonths, setAvailMonths] = useState([]);

  const [factData, setFactData] = useState(null);
  const [factLoading, setFactLoading] = useState(false);
  const [factError, setFactError] = useState(null);

  const [genResult, setGenResult] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState(null);

  useEffect(() => {
    fetchGrants()
      .then(({ grants: gList }) => {
        setGrants(gList);
        if (gList.length > 0) {
          setSelGrant(gList[0].grantId);
          const ms = (gList[0].months || []).sort();
          setAvailMonths(ms);
          if (ms.length > 0) setSelMonth(ms[0]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const g = grants.find((x) => x.grantId === selGrant);
    if (g) {
      const ms = (g.months || []).sort();
      setAvailMonths(ms);
      setSelMonth(ms[0] || '');
    }
  }, [selGrant, grants]);

  useEffect(() => {
    if (!selGrant || !selMonth) return;
    setFactLoading(true); setFactError(null); setFactData(null); setGenResult(null);

    fetchGrantReport(selGrant, selMonth)
      .then(setFactData)
      .catch((e) => setFactError(e.message))
      .finally(() => setFactLoading(false));
  }, [selGrant, selMonth]);

  async function handleGenerate() {
    setGenLoading(true); setGenError(null); setGenResult(null);
    try {
      const r = await generateGrantReport(selGrant, selMonth);
      setGenResult(r);
    } catch (e) { setGenError(e.message); }
    finally { setGenLoading(false); }
  }

  const f = factData?.facts;

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Grant <span>Reporting Assistant</span></h1>
            <p className="page-subtitle">
              Select a grant and reporting month to view structured facts and generate an automated narrative report.
            </p>
          </div>
        </div>
      </div>

      <div className="grant-selector-bar" role="search" aria-label="Grant selection">
        <div className="filter-group">
          <label className="filter-label" htmlFor="grant-select">Grant Portfolio</label>
          <select id="grant-select" className="filter-select" value={selGrant} onChange={(e) => setSelGrant(e.target.value)}>
            {grants.map((g) => (
              <option key={g.grantId} value={g.grantId}>{g.grantName} ({g.donor})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="month-select">Reporting Period</label>
          <select id="month-select" className="filter-select" value={selMonth} onChange={(e) => setSelMonth(e.target.value)}>
            {availMonths.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m] || m}</option>
            ))}
          </select>
        </div>

        {f && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>Report Status</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{f.reportStatus}</div>
            </div>
            <div className="filter-divider" style={{ margin: '0 4px', height: 40 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>Program Risk</div>
              <RiskBadge status={f.riskStatus} />
            </div>
          </div>
        )}
      </div>

      {factLoading && <LoadingState message="Loading fact panel…" />}
      {factError && <ErrorState message={factError} />}

      {f && (
        <div style={{ animation: 'page-fade-in var(--t-slow) var(--ease)' }}>
          <div className="fact-panel">
            <div className="card" role="region" aria-label="Performance Metrics">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--indigo-dim)', color: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={18} strokeWidth={2.5} />
                </div>
                Performance Metrics
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { k: 'Reporting Month',     v: MONTH_LABELS[f.reportingMonth] || f.reportingMonth },
                  { k: 'Covered Districts',   v: f.coveredDistricts?.join(', ') || '—' },
                  { k: 'Sampled Schools',     v: fmt(f.sampledSchoolRecords) },
                  { k: 'Completed PBL',       v: <>{fmt(f.schoolsCompletedPbl)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct(f.pblCompletionRate)})</span></> },
                  { k: 'Evidence Submitted',  v: <>{fmt(f.schoolsWithEvidence)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct(f.evidenceSubmissionRate)})</span></> },
                  { k: 'Total Enrollment',    v: fmt(f.totalEnrollment) },
                  { k: 'Total Attendance',    v: fmt(f.totalAttendance) },
                  { k: 'Attendance Rate',     v: pct(f.attendanceRate) },
                  { k: 'Report Due',          v: f.reportDueDate || '—' },
                ].map((m) => (
                  <div key={m.k} className="fact-row">
                    <span className="fact-key">{m.k}</span>
                    <span className="fact-val">{m.v}</span>
                  </div>
                ))}
              </div>

              {f.trend && (
                <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
                    vs. {MONTH_LABELS[f.trend.prevMonth] || f.trend.prevMonth}
                  </div>
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>Completion</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: f.trend.completionDelta >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                        {f.trend.completionDelta >= 0 ? '↑' : '↓'} {pct(Math.abs(f.trend.completionDelta))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>Attendance</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: f.trend.attendanceDelta >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                        {f.trend.attendanceDelta >= 0 ? '↑' : '↓'} {pct(Math.abs(f.trend.attendanceDelta))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card" role="region" aria-label="Budget and Milestones">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--teal-dim)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} strokeWidth={2.5} />
                </div>
                Budget Utilization
              </div>

              {f.financeLines?.length > 0 ? (
                <div style={{ overflowX: 'auto', marginBottom: 32 }}>
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Budget Line</th>
                        <th>Apprvd</th>
                        <th>Month</th>
                        <th>Cumul.</th>
                        <th>Util%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.financeLines.map((fl, i) => (
                        <tr key={i}>
                          <td>{fl.budgetLine}</td>
                          <td>{fmt(fl.approvedBudgetUnits)}</td>
                          <td>{fmt(fl.monthlyUtilizedUnits)}</td>
                          <td>{fmt(fl.cumulativeUtilizedUnits)}</td>
                          <td className={utilClass(fl.cumulativeUtilizationRate)} style={{ fontWeight: 700 }}>
                            {pct(fl.cumulativeUtilizationRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 16px', marginBottom: 32 }}>
                  <Wallet size={32} opacity={0.3} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>No finance data for this period</div>
                </div>
              )}

              {f.milestoneSummary && (
                <>
                  <div className="section-title" style={{ marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Flag size={18} strokeWidth={2.5} />
                    </div>
                    Key Milestones
                  </div>
                  <ul className="milestone-list">
                    {f.milestoneSummary.split('|').map((m, i) => {
                      const isComplete = m.includes('Completed');
                      const isRisk = m.includes('Risk');
                      return (
                        <li key={i} className="milestone-item">
                          {isComplete ? <CheckCircle2 color="var(--emerald)" /> : isRisk ? <AlertTriangle color="var(--rose)" /> : <Flag color="var(--amber)" />}
                          <span>{m.trim()}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>

          {f.evidenceRefs?.length > 0 && (
            <div style={{ marginBottom: 40 }} role="region" aria-label="Evidence Gallery">
              <div className="section-header" style={{ marginBottom: 20 }}>
                <div className="section-title">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--violet-dim)', color: 'var(--violet-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={18} strokeWidth={2.5} />
                  </div>
                  Evidence & Media
                </div>
                <span className="section-badge" style={{ background: 'var(--violet-dim)', color: 'var(--violet-light)', borderColor: 'rgba(139,92,246,0.2)' }}>
                  {f.evidenceRefs.length} asset{f.evidenceRefs.length !== 1 && 's'}
                </span>
              </div>
              <div className="evidence-gallery">
                {f.evidenceRefs.map((ev) => (
                  <div key={ev.recordId} className="evidence-card">
                    <div className="evidence-img-wrap">
                      <div className="evidence-type-badge">{ev.recordType.replace('_', ' ')}</div>
                      <img
                        src={`${BASE}/${ev.relativePath}`}
                        alt={ev.title}
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="evidence-body">
                      <div className="evidence-title">{ev.title}</div>
                      <div className="evidence-caption">{ev.summaryOrCaption}</div>
                      {ev.district && <div className="evidence-meta"><MapPin /> {ev.district}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button id="btn-generate-grant-report" className="btn btn-primary" onClick={handleGenerate} disabled={genLoading}>
              {genLoading ? <><Loader2 className="spinner" size={16} /> Generating…</> : <><Sparkles size={16} /> Generate Report Section</>}
            </button>
            {genResult && !genResult.aiEnabled && (
              <div className="error-state" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.2)', padding: '10px 16px' }}>
                <AlertTriangle size={16} /> AI narrative generation is disabled by configuration.
              </div>
            )}
          </div>

          {genError && <ErrorState message={genError} />}

          {genResult && (
            <div>
              {genResult.narrative ? (
                <div className="narrative-panel" role="region" aria-label="Generated Narrative">
                  <div className="narrative-header">
                    <div className="narrative-label">
                      <Sparkles size={18} /> AI-Generated Report Section
                      <span className="narrative-pill" style={{ marginLeft: 8 }}>Rule-based</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {MONTH_LABELS[selMonth] || selMonth}
                    </div>
                  </div>
                  <p className="narrative-text" style={{ fontStyle: 'italic', fontSize: 16 }}>"{genResult.narrative}"</p>
                  <div className="narrative-footer">
                    <CheckCircle2 size={14} color="var(--emerald)" /> Every sentence above is sourced from the structured facts above via deterministic templates.
                  </div>
                </div>
              ) : (
                <div className="narrative-panel" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  <div className="narrative-label" style={{ color: 'var(--amber)' }}>
                    <BarChart3 size={18} /> Facts Only Mode
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 16 }}>
                    {genResult.message}
                    <br /><br />
                    All structured metrics above represent the complete deterministic output.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
