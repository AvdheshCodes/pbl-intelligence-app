import { useState, useEffect } from 'react';
import { fetchGrants, fetchGrantReport, generateGrantReport } from '../api/grants';
import { 
  BarChart2, FileText, Image as ImageIcon, Users, Archive, 
  HelpCircle, LogOut, CheckCircle2, Upload, Printer
} from 'lucide-react';
import { LoadingState, ErrorState, pct, fmt } from '../components/UI';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const MONTH_LABELS = { '2025-07': 'July 2025', '2025-08': 'August 2025', '2025-09': 'September 2025' };

export default function GrantReport({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('evidence');
  const [grants, setGrants] = useState([]);
  const [selGrant, setSelGrant] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [availMonths, setAvailMonths] = useState([]);

  const [factData, setFactData] = useState(null);
  const [factLoading, setFactLoading] = useState(false);
  const [factError, setFactError] = useState(null);

  const [genResult, setGenResult] = useState(null);

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

  useEffect(() => {
    // Automatically generate narrative to match the mockup's layout
    if (factData?.facts && selGrant && selMonth) {
      generateGrantReport(selGrant, selMonth).then(setGenResult).catch(console.error);
    }
  }, [factData, selGrant, selMonth]);

  const f = factData?.facts;
  const grantName = grants.find(g => g.grantId === selGrant)?.grantName || 'Loading...';

  return (
    <div className="page-container">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-title">
          Admin Portal
          <small>FY 2025-26</small>
        </div>
        
        <nav className="sidebar-nav">
          <button className="side-link" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}><BarChart2 size={16} /> District Overview</button>
          <button className={`side-link ${activeTab === 'grant' ? 'active' : ''}`} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setActiveTab('grant')}><FileText size={16} /> Grant Status</button>
          <button className={`side-link ${activeTab === 'evidence' ? 'active' : ''}`} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setActiveTab('evidence')}><ImageIcon size={16} /> Evidence Locker</button>
          <button className={`side-link ${activeTab === 'staff' ? 'active' : ''}`} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setActiveTab('staff')}><Users size={16} /> Staff Registry</button>
          <button className={`side-link ${activeTab === 'archive' ? 'active' : ''}`} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setActiveTab('archive')}><Archive size={16} /> Archive</button>
        </nav>

        <div className="sidebar-bottom">
          <button className="btn btn-primary" style={{ width: '100%' }}>New Report</button>
          <div className="side-link" style={{ padding: '8px 0', border: 'none' }}><HelpCircle size={16} /> Support</div>
          <div className="side-link" style={{ padding: '8px 0', border: 'none' }}><LogOut size={16} /> Logout</div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="page-content">
        
        {/* Top Controls (Not in mockup explicitly but needed for app function) */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <select className="filter-select" style={{ width: 300 }} value={selGrant} onChange={(e) => setSelGrant(e.target.value)}>
            {grants.map((g) => <option key={g.grantId} value={g.grantId}>{g.grantName} ({g.donor})</option>)}
          </select>
          <select className="filter-select" style={{ width: 200 }} value={selMonth} onChange={(e) => setSelMonth(e.target.value)}>
            {availMonths.map((m) => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
          </select>
        </div>

        {factLoading && <LoadingState message="Loading Data..." />}
        {factError && <ErrorState message={factError} />}

        {activeTab === 'staff' && (
          <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed var(--border)', marginTop: 32 }}>
            <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Staff Registry</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>This module is currently under development.</p>
          </div>
        )}
        
        {activeTab === 'archive' && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Report Archive</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Access historical grant reports for <strong>{grantName}</strong>.</p>
            
            <div style={{ display: 'grid', gap: 12 }}>
              {availMonths.slice().reverse().map(m => (
                <div key={m} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{MONTH_LABELS[m]} Performance Report</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Status: Finalized</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => { setSelMonth(m); setActiveTab('grant'); }}>View Report</button>
                    <button className="btn btn-secondary" onClick={() => alert('Exporting to PDF...')}>Export PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {f && (activeTab === 'grant' || activeTab === 'evidence') && (
          <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="page-title">Grant Stream: {grantName}</h1>
                <p className="page-subtitle">Active Period: July 2025 — June 2026 • Reporting Month: {MONTH_LABELS[f.reportingMonth]}</p>
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '12px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Implementation Health</div>
                <div style={{ fontSize: 24, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{pct(f.pblCompletionRate, 0)}</div>
                <div style={{ width: 100, height: 4, background: 'var(--border)', margin: '4px auto 0' }}>
                  <div style={{ height: '100%', background: 'var(--yellow-accent)', width: pct(f.pblCompletionRate, 0) }} />
                </div>
              </div>
            </div>

            <div className="grid-2">
              {/* Left Column */}
              <div>
                {activeTab === 'evidence' && (
                  <>
                    <div className="flex-between" style={{ marginBottom: 16 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Classroom Evidence Board</h2>
                      <button className="btn btn-secondary"><Upload size={14} /> Upload Document</button>
                    </div>
                    
                    <div className="evidence-board" style={{ marginBottom: 32 }}>
                      {f.evidenceRefs?.slice(0, 6).map((ev) => (
                        <div key={ev.recordId} className="polaroid">
                          <img src={`${BASE}/${ev.relativePath}`} alt={ev.title} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                          <div className="polaroid-caption">{ev.title}</div>
                          <div className="polaroid-date">{ev.recordId.split('_').pop() || '20 OCT 2025'}</div>
                        </div>
                      ))}
                      {(!f.evidenceRefs || f.evidenceRefs.length === 0) && (
                        <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed var(--border)' }}>No evidence uploaded for this period.</div>
                      )}
                    </div>
                  </>
                )}

                <div className="panel" style={{ padding: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 12 }}>Narrative Implementation Summary</div>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}>
                    {genResult?.narrative ? genResult.narrative : 'Loading narrative synthesis...'}
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div>
                <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="panel-header-small">Recognition & Impact Clips</div>
                  <div style={{ padding: 24 }}>
                    <div className="testimonial">
                      <div className="testimonial-avatar">MS</div>
                      <div className="testimonial-body">
                        <div className="testimonial-quote">"The students finally 'clicked' with the concepts today. The new PBL materials are fantastic."</div>
                        <div className="testimonial-author">— Maria Santos, Lead Educator</div>
                      </div>
                    </div>
                    <div className="testimonial">
                      <div className="testimonial-avatar" style={{ background: 'var(--brand-green-dim)' }}>JK</div>
                      <div className="testimonial-body">
                        <div className="testimonial-quote">"Reporting has never been this clean. Seeing the photos next to the data helps the Board understand the value."</div>
                        <div className="testimonial-author">— James K., District Superintendent</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <a href="#" style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-green)', textTransform: 'uppercase', letterSpacing: 0.5, textDecoration: 'none' }}>View All Testimonials</a>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 16 }}>Status Ledger</div>
                  <ul className="ledger-list">
                    <li className="ledger-item">
                      <span>Staff Training (Modules 1-4)</span>
                      <CheckCircle2 size={16} color="var(--status-good)" />
                    </li>
                    <li className="ledger-item">
                      <span>Material Distribution</span>
                      <span style={{ borderBottom: '1px solid var(--text-primary)', color: 'var(--text-primary)', fontWeight: 500 }}>In Progress</span>
                    </li>
                    <li className="ledger-item" style={{ opacity: 0.5 }}>
                      <span>Parent Orientation</span>
                      <span>Pending</span>
                    </li>
                    
                    <button className="btn btn-primary export-btn" style={{ background: 'var(--brand-green)' }}>
                      <Printer size={12} /> Export Full Ledger
                    </button>
                  </ul>

                  <div className="burn-rate">
                    <span className="burn-rate-label">Current Burn Rate</span>
                    <span className="burn-rate-val">₹{fmt(f.financeLines?.[0]?.monthlyUtilizedUnits || 14200)} / mo</span>
                  </div>
                </div>

                <div className="panel" style={{ padding: 24, background: '#f5f3ee' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 12 }}>Program Benchmarks</div>
                  <table className="benchmark-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Target</th>
                        <th>Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Attendance Rate</td>
                        <td>0.70</td>
                        <td className={`actual ${f.attendanceRate >= 0.7 ? 'good' : ''}`}>{pct(f.attendanceRate)}</td>
                      </tr>
                      <tr>
                        <td>Evidence Submission</td>
                        <td>0.80</td>
                        <td className={`actual ${f.evidenceSubmissionRate >= 0.8 ? 'good' : ''}`}>{pct(f.evidenceSubmissionRate)}</td>
                      </tr>
                      <tr>
                        <td>Completion Rate</td>
                        <td>0.85</td>
                        <td className={`actual ${f.pblCompletionRate >= 0.85 ? 'good' : ''}`}>{pct(f.pblCompletionRate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
