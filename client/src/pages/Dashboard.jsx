import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, FileText, CheckCircle2, X, Minus } from 'lucide-react';
import { fetchDashboard, fetchFilters, fetchGeographies } from '../api/dashboard';
import { generateProgramReport } from '../api/grants';
import {
  KpiCard, RiskBadge, LoadingState, ErrorState, pct, fmt
} from '../components/UI';

const MONTH_LABELS = { '2025-07': 'July 2025', '2025-08': 'Aug 2025', '2025-09': 'Sep 2025' };

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

export default function Dashboard({ searchQuery = '' }) {
  const [filters, setFilters]         = useState(INITIAL_FILTERS);
  const [filterOpts, setFilterOpts]   = useState({ months: [], districts: [], blocks: [], grades: ['6','7','8'], subjects: ['Math','Science'] });
  const [dash, setDash]               = useState(null);
  const [geo, setGeo]                 = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [geoLoading, setGeoLoading]   = useState(true);
  const [error, setError]             = useState(null);

  // Report Generation State
  const [progReport, setProgReport]     = useState(null);
  const [progLoading, setProgLoading]   = useState(false);
  const [progError, setProgError]       = useState(null);
  const [progOpen, setProgOpen]         = useState(false);
  const [progModalOpen, setProgModalOpen] = useState(false);

  useEffect(() => {
    fetchFilters(filters.district !== 'All' ? filters.district : '')
      .then((d) => setFilterOpts((prev) => ({ ...prev, ...d })))
      .catch(console.error);
  }, [filters.district]);

  const params = buildParams(filters);
  useEffect(() => {
    setDashLoading(true); setError(null); setGeoLoading(true); setProgReport(null);
    fetchDashboard(params)
      .then(setDash)
      .catch((e) => setError(e.message))
      .finally(() => setDashLoading(false));

    fetchGeographies(params)
      .then(setGeo)
      .catch(console.error)
      .finally(() => setGeoLoading(false));
  }, [JSON.stringify(params)]);

  function setFilter(key, val) {
    setFilters((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'district') next.block = 'All';
      return next;
    });
  }

  async function handleGenerateReport() {
    setProgOpen(true);
    setProgModalOpen(true);
    setProgLoading(true);
    setProgError(null);
    try {
      const r = await generateProgramReport({
        month:    filters.month   !== 'All' ? filters.month   : 'All',
        district: filters.district !== 'All' ? filters.district : 'All',
        block:    filters.block    !== 'All' ? filters.block    : 'All',
      });
      setProgReport(r);
    } catch (e) {
      setProgError(e.message);
    } finally {
      setProgLoading(false);
    }
  }

  const kpis = dash?.kpis;
  const trend = dash?.trend;
  const rows = geo?.rows || [];

  const barData = trend?.type === 'series'
    ? trend.data.map((d) => ({
        month: d.month.split('-')[1],
        val: d.participationRate,
        isCurrent: d.month === filters.month
      }))
    : [];

  const filteredGeos = geo?.rows?.filter(item => 
    !searchQuery || 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getRiskClass = (s) => s?.toLowerCase() || 'neutral';

  return (
    <div className="page-container">
      <div className="page-content">
        
        <div className="page-header">
          <h1 className="page-title">{filters.block !== 'All' ? 'Block' : 'District'} Performance Overview</h1>
          <p className="page-subtitle">Academic Year 2025-26 • Status as of {filters.month !== 'All' ? MONTH_LABELS[filters.month] : 'Current Term'}</p>
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">District</label>
            <select className="filter-select" value={filters.district} onChange={(e) => setFilter('district', e.target.value)}>
              <option value="All">All Districts</option>
              {filterOpts.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">School Term</label>
            <select className="filter-select" value={filters.month} onChange={(e) => setFilter('month', e.target.value)}>
              <option value="All">All Terms</option>
              {filterOpts.months.map((m) => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Subject Stream</label>
            <select className="filter-select" value={filters.subject.join(',')} onChange={(e) => setFilters(p => ({...p, subject: e.target.value ? [e.target.value] : []}))}>
              <option value="">All Subjects</option>
              <option value="Math">Math</option>
              <option value="Science">Science</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={handleGenerateReport} disabled={progLoading}>
              {progLoading ? <Loader2 size={14} className="spinner" /> : 'Generate Report'}
            </button>
          </div>
        </div>

        {dashLoading ? <LoadingState message="Aggregating performance metrics..." /> : error ? <ErrorState message={error} /> : kpis && (
          <>
            <div className="kpi-grid">
              <KpiCard 
                label="Total Schools" 
                value={fmt(kpis.totalSchools)} 
                sub={`Participating: ${fmt(kpis.participatingSchools)}`}
              />
              <KpiCard 
                label="Program Utilization" 
                value={pct(kpis.participationRate)} 
                trend={trend?.type !== 'series' ? trend?.participationDelta : null}
                progress={kpis.participationRate}
              />
              <KpiCard 
                label="Evidence Submitted" 
                value={pct(kpis.evidenceRate)} 
                sub={`${fmt(kpis.evidenceSubmissions)} submissions`}
              />
              <KpiCard 
                label="Student Enrollment" 
                value={fmt(kpis.totalEnrollment)} 
              />
              <KpiCard 
                label="Total Attendance" 
                value={fmt(kpis.totalAttendance)} 
              />
              <KpiCard 
                label="Attendance Rate" 
                value={pct(kpis.attendanceRateAmongParticipants)} 
                trend={trend?.type !== 'series' ? trend?.attendanceDelta : null}
              />
              <KpiCard 
                label="Schools On Track" 
                value={fmt(kpis.riskDistribution?.onTrack || 0)} 
                status="On Track"
              />
              <KpiCard 
                label="Critical Risk Areas" 
                value={fmt(kpis.riskDistribution?.critical || 0)} 
                status="Critical"
              />
            </div>

            <div className="table-card">
              <div className="table-header-dark">
                {geo?.groupKey === 'block' ? 'Block Register' : 'District Register'}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{geo?.groupKey === 'block' ? 'Block Name' : 'District Name'}</th>
                    <th>Schools</th>
                    <th>Participation Rate</th>
                    <th>Evidence Rate</th>
                    <th>Performance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {geoLoading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32 }}><LoadingState message="Loading..." /></td></tr>
                  ) : filteredGeos.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32 }}>No records found.</td></tr>
                  ) : (
                    filteredGeos.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.totalSchools}</td>
                        <td>{pct(row.participationRate, 0)}</td>
                        <td>{pct(row.evidenceRate, 0)}</td>
                        <td><RiskBadge status={row.riskLabel} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="table-footer">
                <span>Showing {rows.length} of {rows.length} {geo?.groupKey === 'block' ? 'Blocks' : 'Districts'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="icon-btn" style={{ border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: '#fff' }}><ChevronLeft size={14} /></button>
                  <button className="icon-btn" style={{ border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: '#fff' }}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-header">Metric History: Utilization</div>
                {barData.length > 0 ? (
                  <div style={{ height: 200, width: '100%', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="10%">
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} dy={10} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', fontSize: 12 }} formatter={(v) => pct(v)} />
                        <Bar dataKey="val">
                          {barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.val > 0.8 ? 'var(--brand-green)' : '#e2e5dc'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 1, background: 'var(--border)' }} />
                  </div>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Select "All Terms" to view metric history.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">Program Notices</div>
                <div className="notice-item">
                  <div className="notice-label">Upcoming Deadline</div>
                  <div className="notice-text">FY25 Q3 Compliance reports due in 5 days.</div>
                </div>
                <div className="notice-item warn">
                  <div className="notice-label">Participation Alert</div>
                  <div className="notice-text">Average participation dipped below 70% threshold this cycle.</div>
                </div>
                <div className="notice-item crit">
                  <div className="notice-label">Audit Notice</div>
                  <div className="notice-text">{kpis.riskDistribution?.critical || 0} schools marked critical; scheduled for priority review.</div>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', marginTop: 24 }}>View All Notifications</button>
              </div>
            </div>

            {/* Program Report Output Area */}
            {progOpen && (
              <div className="panel" style={{ marginTop: 32, borderTop: '4px solid var(--brand-green)' }} id="report-output">
                <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText color="var(--brand-green)" /> Generated Program Report
                  <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 10, padding: '4px 8px' }} onClick={() => setProgModalOpen(true)}>Open in Modal</button>
                </div>
                
                {progLoading ? (
                  <LoadingState message="Synthesizing program intelligence..." />
                ) : progError ? (
                  <ErrorState message={progError} />
                ) : progReport ? (
                  <div>
                    {!progReport.aiEnabled && (
                      <div className="notice-item warn" style={{ marginBottom: 24 }}>
                        <div className="notice-label">AI Generation Disabled</div>
                        <div className="notice-text">{progReport.message}</div>
                      </div>
                    )}

                    {progReport.narrative && (
                      <div style={{ padding: 24, background: '#f5f3ee', borderRadius: 'var(--radius-xs)', marginBottom: 24, borderLeft: '4px solid var(--brand-green)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brand-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Sparkles size={14} /> AI-Generated Narrative (Rule-Based)
                        </div>
                        <p style={{ fontSize: 15, lineHeight: 1.8, fontStyle: 'italic', color: 'var(--text-primary)' }}>
                          "{progReport.narrative}"
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                      {[
                        { label: 'Scope',            val: progReport.facts.scope },
                        { label: 'Total Schools',    val: fmt(progReport.facts.totalSchools) },
                        { label: 'Participating',    val: `${fmt(progReport.facts.participatingSchools)} (${pct(progReport.facts.participationRate)})` },
                        { label: 'Evidence Rate',    val: pct(progReport.facts.evidenceRate) },
                        { label: 'Attendance Rate',  val: pct(progReport.facts.attendanceRate) },
                        { label: 'Overall Risk',     val: <RiskBadge status={progReport.facts.geographyRiskLabel} /> },
                      ].map((m) => (
                        <div key={m.label} style={{ border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-xs)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{m.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            {/* Modal Overlay */}
            {progModalOpen && (
              <div className="modal-overlay" onClick={() => setProgModalOpen(false)}>
                <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="modal-title"><FileText size={18} /> Program Report</div>
                    <div className="modal-actions">
                      <button className="modal-btn" onClick={() => setProgModalOpen(false)} title="Minimize"><Minus size={16} /></button>
                      <button className="modal-btn" onClick={() => setProgModalOpen(false)} title="Close"><X size={16} /></button>
                    </div>
                  </div>
                  <div className="modal-body">
                    {progLoading ? (
                      <LoadingState message="Synthesizing program intelligence..." />
                    ) : progError ? (
                      <ErrorState message={progError} />
                    ) : progReport ? (
                      <div>
                        {progReport.narrative && (
                          <div style={{ padding: 24, background: '#f5f3ee', borderRadius: 'var(--radius-xs)', marginBottom: 24, borderLeft: '4px solid var(--brand-green)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brand-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Sparkles size={14} /> AI-Generated Narrative
                            </div>
                            <p style={{ fontSize: 15, lineHeight: 1.8, fontStyle: 'italic', color: 'var(--text-primary)' }}>
                              "{progReport.narrative}"
                            </p>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                          {[
                            { label: 'Scope',            val: progReport.facts.scope },
                            { label: 'Total Schools',    val: fmt(progReport.facts.totalSchools) },
                            { label: 'Participating',    val: `${fmt(progReport.facts.participatingSchools)} (${pct(progReport.facts.participationRate)})` },
                            { label: 'Evidence Rate',    val: pct(progReport.facts.evidenceRate) },
                            { label: 'Attendance Rate',  val: pct(progReport.facts.attendanceRate) },
                          ].map((m) => (
                            <div key={m.label} style={{ border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-xs)' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{m.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
