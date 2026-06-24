import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function Dashboard() {
  const [filters, setFilters]         = useState(INITIAL_FILTERS);
  const [filterOpts, setFilterOpts]   = useState({ months: [], districts: [], blocks: [], grades: ['6','7','8'], subjects: ['Math','Science'] });
  const [dash, setDash]               = useState(null);
  const [geo, setGeo]                 = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [geoLoading, setGeoLoading]   = useState(true);
  const [error, setError]             = useState(null);

  // Pagination mock state for the table (just UI)
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchFilters(filters.district !== 'All' ? filters.district : '')
      .then((d) => setFilterOpts((prev) => ({ ...prev, ...d })))
      .catch(console.error);
  }, [filters.district]);

  const params = buildParams(filters);
  useEffect(() => {
    setDashLoading(true); setError(null); setGeoLoading(true);
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

  const kpis = dash?.kpis;
  const trend = dash?.trend;
  const rows = geo?.rows || [];

  // Adapt the trend series to a bar chart matching the mockup
  const barData = trend?.type === 'series'
    ? trend.data.map((d) => ({
        month: d.month.split('-')[1], // Just "07", "08" etc, or map to JAN, FEB
        val: d.participationRate,
        isCurrent: d.month === filters.month
      }))
    : [];

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
            <button className="btn btn-primary" onClick={() => alert('Report generated.')}>Generate Report</button>
          </div>
        </div>

        {dashLoading ? <LoadingState message="Aggregating performance metrics..." /> : error ? <ErrorState message={error} /> : kpis && (
          <>
            <div className="kpi-grid">
              <KpiCard 
                label="Student Enrollment" 
                value={fmt(kpis.totalEnrollment)} 
                trend={trend?.type !== 'series' ? trend?.participationDelta : null}
              />
              <KpiCard 
                label="Program Utilization" 
                value={pct(kpis.participationRate)} 
                progress={kpis.participationRate}
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
                    <th>Compliance Score</th>
                    <th>Performance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {geoLoading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32 }}><LoadingState message="Loading..." /></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32 }}>No records found.</td></tr>
                  ) : (
                    rows.map((row) => (
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
          </>
        )}
      </div>
    </div>
  );
}
