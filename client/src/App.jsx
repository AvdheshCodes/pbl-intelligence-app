import { useState } from 'react';
import { Search, Bell, User } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import GrantReport from './pages/GrantReport';
import './index.css';

const PAGES = [
  { id: 'dashboard', label: 'Performance' },
  { id: 'grants',    label: 'Reporting' },
  { id: 'directory', label: 'Directory' },
  { id: 'settings',  label: 'Settings' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#" className="topbar-brand" onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}>
          AcademicLedger
        </a>

        <nav className="topbar-nav" role="navigation">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-link ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="search-bar">
            <input type="text" placeholder="Search data..." />
            <Search />
          </div>
          <button className="icon-btn"><Bell size={18} /></button>
          <button className="icon-btn"><User size={18} /></button>
        </div>
      </header>

      {/* Pages render their own layout containers (sidebar or full-width) */}
      {page === 'dashboard' ? <Dashboard /> : <GrantReport onNavigate={setPage} />}

      <footer style={{ padding: '24px', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        © 2024 AcademicLedger Management System. Confidential Administrator View.
      </footer>
    </div>
  );
}
