import { useState, useEffect } from 'react';
import { Search, Bell, User, Moon, Sun } from 'lucide-react';
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
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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
            <input 
              type="text" 
              placeholder="Search data..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search />
          </div>
          <button className="icon-btn" onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn"><Bell size={18} /></button>
          <button className="icon-btn"><User size={18} /></button>
        </div>
      </header>

      {/* Pages render their own layout containers (sidebar or full-width) */}
      {page === 'dashboard' && <Dashboard searchQuery={searchQuery} />}
      {page === 'grants' && <GrantReport onNavigate={setPage} searchQuery={searchQuery} />}
      {page === 'directory' && (
        <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Directory</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Global staff and school directory is under development.</p>
          </div>
        </div>
      )}
      {page === 'settings' && (
        <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>System Settings</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Admin configuration module is under development.</p>
          </div>
        </div>
      )}

      <footer style={{ padding: '24px', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        © 2024 AcademicLedger Management System. Confidential Administrator View.
      </footer>
    </div>
  );
}
