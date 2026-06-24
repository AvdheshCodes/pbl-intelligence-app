import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchDashboard, fetchFilters, fetchGeographies } from '../api/dashboard';
import { generateProgramReport } from '../api/grants';
import {
  KpiCard, RiskBadge, ProgressBar, RiskDist,
  LoadingState, ErrorState, pct, fmt, getRiskColor,
} from '../components/UI';

const MONTH_LABELS = { '2025-07': 'July 2025', '2025-08': 'Aug 2025', '2025-09': 'Sep 2025' };

/* ── Custom Recharts Tooltip ─────────────────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 120,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginTop: 2, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>
            {typeof p.value === 'number' && p.value <= 1 ? pct(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Filter helpers ──────────────────────────────────────────────────────── */
function buildParams(f) {
  const p = {};
  if (f.month   !== 'All') p.month   = f.month;
  if (f.district !== 'All') p.district = f.district;
  if (f.block    !== 'All') p.block    = f.block;
  if (f.grade.length)   p.grade   = f.grade.join(',');
  if (f.subject.length) p.subject = f.subject.join(',');
  return p;
}

const INITIAL_FILTERS = { month: 'All', district: 'All', block: 'All', grade: [], subject: [] };

/* ── Risk bar chart data ─────────────────────────────────────────────────── */
const RISK_BAR = [
  { name: 'On Track', key: 'onTrack', fill: '#10b981' },
  { name: 'Behind',   key: 'behind',  fill: '#f59e0b' },
  { name: 'At Risk',  key: 'atRisk',  fill: '#f97316' },
  { name: 'Critical', key: 'critical', fill: '#f43f5e' },
];

/* ────────────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [filters, setFilters]         = useState(INITIAL_FILTERS);
  const [filterOpts, setFilterOpts]   = useState({ months: [], districts: [], blocks: [], grades: ['6','7','8'], subjects: ['Math','Science'] });
  const [dash, setDash]               = useState(null);
  const [geo, setGeo]                 = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [geoLoading, setGeoLoading]   = useState(true);
  const [error, setError]             = useState(null);
  const [sortKey, setSortKey]         = useState('participationRate');
  const [sortDir, setSortDir]         = useState('asc');

  // Tier 2 — Program Report
  const [progReport, setProgReport]     = useState(null);
  const [progLoading, setProgLoading]   = useState(false);
  const [progError, setProgError]       = useState(null);
  const [progOpen, setProgOpen]         = useState(false);

  // Load filter dropdowns (blocks depend on selected district)
  useEffect(() => {
    fetchFilters(filters.district !== 'All' ? filters.district : '')
      .then((d) => setFilterOpts((prev) => ({ ...prev, ...d })))
      .catch(console.error);
  }, [filters.district]);

  // Reload data whenever filters change
  const params = buildParams(filters);
  useEffect(() => {
    setDashLoading(true); setError(null); setGeoLoading(true);
    setProgReport(null);

    fetchDashboard(params)
      .then(setDash)
      .catch((e) => setError(e.message))
      .finally(() => setDashLoading(false));

    fetchGeographies(params)
      .then(setGeo)
      .catch(console.error)
      .finally(() => setGeoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  function setFilter(key, val) {
    setFilters((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'district') next.block = 'All';
      return next;
    });
  }
  function toggleChip(key, val) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter((v) => v !== val) : [...prev[key], val],
    }));
  }
  function resetFilters() { setFilters(INITIAL_FILTERS); setProgReport(null); }

  function handleSort(key) {
    setSortDir((d) => sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortKey(key);
  }

  const sortedRows = (geo?.rows || []).slice().sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  async function handleGenerateProg() {
    setProgLoading(true); setProgError(null);
    try {
      const r = await generateProgramReport({
        month:    filters.month   !== 'All' ? filters.month   : 'All',
        district: filters.district !== 'All' ? filters.district : 'All',
        block:    filters.block    !== 'All' ? filters.block    : 'All',
      });
      setProgReport(r);
    } catch (e) { setProgError(e.message); }
    finally { setProgLoading(false); }
  }

  const kpis = dash?.kpis;
  const trend = dash?.trend;

  const trendSeries = trend?.type === 'series'
    ? trend.data.map((d) => ({ month: MONTH_LABELS[d.month] || d.month, Participation: d.participationRate, Attendance: d.attendanceRate }))
    : null;

  const riskBarData = RISK_BAR.map((r) => ({ ...r, value: kpis?.riskDistribution?.[r.key] ?? 0 }));
  const sortIcon = (k) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  /* active filter summary */
  const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
    k !== 'month' && (Array.isArray(v) ? v.length > 0 : v !== 'All')
  ).length + (filters.month !== 'All' ? 1 : 0);

  return (
    <>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">
              Program <span>Review Dashboard</span>
            </h1>
            <p className="page-subtitle">
              School-level PBL performance · July–September 2025
              {kpis && ` · ${fmt(kpis.totalSchools)} schools in current view`}
              {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="filter-bar" role="search" aria-label="Dashboard filters">
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-month">Month</label>
          <select id="filter-month" className="filter-select" value={filters.month}
            onChange={(e) => setFilter('month', e.target.value)}>
            <option value="All">All Months</option>
            {filterOpts.months.map((m) => <option key={m} value={m}>{MONTH_LABELS[m] || m}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-district">District</label>
          <select id="filter-district" className="filter-select" value={filters.district}
            onChange={(e) => setFilter('district', e.target.value)}>
            <option value="All">All Districts</option>
            {filterOpts.districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-block">Block</label>
          <select id="filter-block" className="filter-select" value={filters.block}
            onChange={(e) => setFilter('block', e.target.value)}
            disabled={filters.district === 'All'}>
            <option value="All">All Blocks</option>
            {filterOpts.blocks.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="filter-divider" aria-hidden="true" />

        <div className="filter-group">
          <label className="filter-label">Grade</label>
          <div className="chip-group" role="group" aria-label="Grade filter">
            {['6','7','8'].map((g) => (
              <button key={g} id={`grade-chip-${g}`}
                className={`chip ${filters.grade.includes(g) ? 'selected' : ''}`}
                onClick={() => toggleChip('grade', g)}
                aria-pressed={filters.grade.includes(g)}>
                Class {g}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Subject</label>
          <div className="chip-group" role="group" aria-label="Subject filter">
            {['Math','Science'].map((s) => (
              <button key={s} id={`subject-chip-${s}`}
                className={`chip ${filters.subject.includes(s) ? 'selected' : ''}`}
                onClick={() => toggleChip('subject', s)}
                aria-pressed={filters.subject.includes(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <button id="reset-filters" className="btn-reset" onClick={resetFilters} aria-label="Reset all filters">
            ✕ Reset
          </button>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      {dashLoading
        ? <LoadingState message="Computing program metrics…" />
        : error
          ? <ErrorState message={error} />
          : kpis && (
        <div className="kpi-grid" role="region" aria-label="Key performance indicators">
          <KpiCard id="kpi-total-schools"
            label="Total Schools" value={fmt(kpis.totalSchools)}
            icon="🏫" accentColor="var(--indigo)" iconBg="var(--indigo-dim)"
          />
          <KpiCard id="kpi-participating"
            label="Participating Schools" value={fmt(kpis.participatingSchools)}
            sub={`${pct(kpis.participationRate)} of all schools`}
            icon="✅" accentColor="var(--emerald)" iconBg="var(--emerald-dim)"
            glowColor="rgba(16,185,129,0.15)"
            trend={trend && !trend.type ? trend.participationDelta : null}
          />
          <KpiCard id="kpi-evidence"
            label="Evidence Submissions" value={fmt(kpis.evidenceSubmissions)}
            sub={`${pct(kpis.evidenceRate)} of participants`}
            icon="📎" accentColor="var(--teal)" iconBg="var(--teal-dim)"
          />
          <KpiCard id="kpi-enrollment"
            label="Total Enrollment" value={fmt(kpis.totalEnrollment)}
            sub="all filtered schools" icon="👨‍🎓"
            accentColor="var(--violet)" iconBg="var(--violet-dim)"
          />
          <KpiCard id="kpi-attendance-sessions"
            label="Total Attendance Sessions" value={fmt(kpis.totalAttendance)}
            sub="Math + Science sessions combined" icon="📅"
            accentColor="var(--indigo)" iconBg="var(--indigo-dim)"
          />
          <KpiCard id="kpi-attendance-rate"
            label="Attendance Rate" value={pct(kpis.attendanceRateAmongParticipants)}
            sub="avg among participating schools only"
            icon="📈" accentColor="var(--teal)" iconBg="var(--teal-dim)"
            glowColor="rgba(20,184,166,0.15)"
            trend={trend && !trend.type ? trend.attendanceDelta : null}
          />
          <KpiCard id="kpi-non-participants"
            label="Non-Participants" value={fmt(kpis.totalSchools - kpis.participatingSchools)}
            sub="schools that skipped this month"
            icon="⏸" accentColor="var(--amber)" iconBg="var(--amber-dim)"
            glowColor="rgba(245,158,11,0.15)"
          />
        </div>
      )}

      {/* ── Charts row ────────────────────────────────────────────────── */}
      {!dashLoading && kpis && (
        <div className="dashboard-grid">
          {/* Risk distribution */}
          <div className="chart-card" role="region" aria-label="Risk distribution chart">
            <div className="section-header">
              <div className="section-title">Risk Distribution</div>
              <span className="section-badge">{fmt(kpis.totalSchools)} schools</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={riskBarData} barCategoryGap="35%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="value" radius={[5,5,0,0]}>
                  {riskBarData.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {riskBarData.map((r) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.fill, display: 'inline-block', flexShrink: 0 }} />
                  {r.name}: <strong style={{ color: r.fill }}>{r.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Trend line */}
          <div className="chart-card" role="region" aria-label="Trend chart">
            <div className="section-title" style={{ marginBottom: 14 }}>3-Month Trend</div>
            {trendSeries ? (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={trendSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${(v*100).toFixed(0)}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0,1]} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Participation" stroke="#818cf8" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#818cf8' }}
                    activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Attendance" stroke="#14b8a6" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#14b8a6' }}
                    activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
                {trend && !trend.type ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '0 12px' }}>
                    <div style={{ marginBottom: 6, color: 'var(--text-muted)', fontSize: 11 }}>vs. {MONTH_LABELS[trend.prevMonth] || trend.prevMonth}</div>
                    <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Participation</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: trend.participationDelta >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                          {trend.participationDelta >= 0 ? '+' : ''}{pct(trend.participationDelta)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Attendance</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: trend.attendanceDelta >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                          {trend.attendanceDelta >= 0 ? '+' : ''}{pct(trend.attendanceDelta)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11 }}>Select "All Months" for trend line chart</div>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 28, opacity: 0.3 }}>📈</span>
                    <span style={{ fontSize: 12 }}>Select "All Months" for trend line</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Geographic Performance Table ───────────────────────────────── */}
      {!dashLoading && (
        <div style={{ marginBottom: 24 }} role="region" aria-label="Geographic performance table">
          <div className="section-header">
            <div>
              <div className="section-title">
                {geo?.groupKey === 'block' ? 'Block' : 'District'}-Level Performance
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Sorted worst-first by default · click column headers to resort
              </div>
            </div>
            <span className="section-badge">
              {sortedRows.length} {geo?.groupKey === 'block' ? 'blocks' : 'districts'}
            </span>
          </div>

          {geoLoading
            ? <LoadingState message="Aggregating geographies…" />
            : (
            <div className="table-wrap">
              <table className="data-table" aria-label="Geographic performance">
                <thead>
                  <tr>
                    <th id="col-name" className={sortKey === 'name' ? 'sorted' : ''} onClick={() => handleSort('name')}>
                      {geo?.groupKey === 'block' ? 'Block' : 'District'}{sortIcon('name')}
                    </th>
                    <th id="col-schools" className={sortKey === 'totalSchools' ? 'sorted' : ''} onClick={() => handleSort('totalSchools')}>
                      Schools{sortIcon('totalSchools')}
                    </th>
                    <th id="col-participation" className={sortKey === 'participationRate' ? 'sorted' : ''} onClick={() => handleSort('participationRate')}>
                      Participation{sortIcon('participationRate')}
                    </th>
                    <th id="col-evidence" className={sortKey === 'evidenceRate' ? 'sorted' : ''} onClick={() => handleSort('evidenceRate')}>
                      Evidence{sortIcon('evidenceRate')}
                    </th>
                    <th id="col-attendance" className={sortKey === 'avgAttendanceRate' ? 'sorted' : ''} onClick={() => handleSort('avgAttendanceRate')}>
                      Attendance (participants){sortIcon('avgAttendanceRate')}
                    </th>
                    <th id="col-risk" className={sortKey === 'riskLabel' ? 'sorted' : ''} onClick={() => handleSort('riskLabel')}>
                      Risk{sortIcon('riskLabel')}
                    </th>
                    <th id="col-dist">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <div className="geo-name">
                          {row.name}
                          <small>{row.participatingSchools} of {row.totalSchools} active</small>
                        </div>
                      </td>
                      <td className="mono">{row.totalSchools}</td>
                      <td>
                        <div className="mono" style={{ fontWeight: 600 }}>{pct(row.participationRate)}</div>
                        <ProgressBar value={row.participationRate}
                          color={row.participationRate >= 0.75 ? 'var(--emerald)' : row.participationRate >= 0.5 ? 'var(--amber)' : 'var(--rose)'} />
                      </td>
                      <td>
                        <div className="mono">{pct(row.evidenceRate)}</div>
                        <ProgressBar value={row.evidenceRate} color="var(--teal)" />
                      </td>
                      <td>
                        {row.participatingSchools > 0 ? (
                          <>
                            <div className="mono" style={{ fontWeight: 600 }}>{pct(row.avgAttendanceRate)}</div>
                            <ProgressBar value={row.avgAttendanceRate} color={getRiskColor(row.riskLabel)} />
                          </>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No sessions</span>}
                      </td>
                      <td>
                        <RiskBadge status={row.riskLabel} title={row.riskReason} />
                      </td>
                      <td><RiskDist d={row.riskDistribution} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tier 2: Program Reporting Assistant ───────────────────────── */}
      <div className="program-report-panel" role="region" aria-label="Program Reporting Assistant">
        <div className="section-header">
          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span>✨</span> Program Reporting Assistant
              <span className="section-badge" style={{ background: 'var(--violet-dim)', color: 'var(--violet)', borderColor: 'rgba(139,92,246,0.15)' }}>Tier 2</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Generate a structured program narrative for the current filter scope
            </div>
          </div>
          <button id="btn-gen-program-report"
            className="btn btn-primary"
            onClick={() => { setProgOpen(true); handleGenerateProg(); }}
            disabled={progLoading}>
            {progLoading
              ? <><span className="spinner" />Generating…</>
              : '✨ Generate Program Summary'}
          </button>
        </div>

        {progError && <ErrorState message={progError} />}

        {progReport && progOpen && (
          <div style={{ marginTop: 16 }}>
            {!progReport.aiEnabled && (
              <div className="ai-disabled-note" style={{ marginBottom: 14 }}>
                ⚠️ {progReport.message}
              </div>
            )}

            {progReport.narrative && (
              <div className="narrative-panel">
                <div className="narrative-header">
                  <div className="narrative-label">
                    ✦ AI-Generated Program Summary
                    <span className="narrative-pill">Rule-based</span>
                  </div>
                </div>
                <p className="narrative-text">{progReport.narrative}</p>
                <div className="narrative-footer">
                  ✓ All figures are sourced from the structured facts object below — no numbers are invented.
                </div>
              </div>
            )}

            <div className="facts-mini-grid">
              {[
                { label: 'Scope',            val: progReport.facts.scope },
                { label: 'Total Schools',    val: fmt(progReport.facts.totalSchools) },
                { label: 'Participating',    val: `${fmt(progReport.facts.participatingSchools)} · ${pct(progReport.facts.participationRate)}` },
                { label: 'Evidence Rate',    val: pct(progReport.facts.evidenceRate) },
                { label: 'Attendance Rate',  val: pct(progReport.facts.attendanceRate) },
                { label: 'Overall Status',   val: <RiskBadge status={progReport.facts.geographyRiskLabel} /> },
                { label: 'On Track',         val: progReport.facts.riskDistribution.onTrack },
                { label: 'Behind',           val: progReport.facts.riskDistribution.behind },
                { label: 'At Risk',          val: progReport.facts.riskDistribution.atRisk },
                { label: 'Critical',         val: progReport.facts.riskDistribution.critical },
                { label: 'Priority Follow-up', val: progReport.facts.topGap || 'N/A' },
              ].map((m) => (
                <div key={m.label} className="facts-mini-item">
                  <div className="facts-mini-label">{m.label}</div>
                  <div className="facts-mini-val">{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
