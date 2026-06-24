import { useState } from 'react';
import { LayoutDashboard, FileText, Target, Activity } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import GrantReport from './pages/GrantReport';
import './index.css';

const PAGES = [
  { id: 'dashboard', label: 'Program Dashboard', icon: LayoutDashboard },
  { id: 'grants',    label: 'Grant Reports',     icon: FileText },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div className="app-shell">
      <header className="topbar">
        {/* Brand */}
        <div className="topbar-brand">
          <div className="topbar-brand-icon">
            <Target size={20} strokeWidth={2.5} />
          </div>
          <span>PBL Intelligence</span>
          <span className="topbar-badge">Mantra4Change</span>
        </div>

        {/* Nav pills */}
        <nav className="topbar-nav" role="navigation" aria-label="Main navigation">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                id={`nav-${p.id}`}
                className={`nav-btn ${page === p.id ? 'active' : ''}`}
                onClick={() => setPage(p.id)}
                aria-current={page === p.id ? 'page' : undefined}
              >
                <span className="nav-icon"><Icon size={16} strokeWidth={2.5} /></span>
                {p.label}
              </button>
            );
          })}
        </nav>

        {/* Live status */}
        <div className="topbar-right">
          <div className="topbar-status">
            <Activity size={14} className="status-icon" color="var(--emerald)" />
            <span className="status-dot" aria-hidden="true" />
            <span>Live data · Jul–Sep 2025</span>
          </div>
        </div>
      </header>

      <main className="page-content" role="main">
        {page === 'dashboard' ? <Dashboard /> : <GrantReport />}
      </main>
    </div>
  );
}
