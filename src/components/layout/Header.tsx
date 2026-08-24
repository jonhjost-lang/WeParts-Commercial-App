import { useEffect, useMemo, useState } from 'react';
import weatherfordLogo from '../../assets/logo-wtfd.png';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface HeaderProps { onNavigate: (screen: string) => void; }

const destinations = [
  { id: 'home', label: 'Home', hint: 'Global sales portal' },
  { id: 'catalog', label: 'Purchase Catalog', hint: 'Browse MPD products and pricing' },
  { id: 'orders', label: 'My Orders', hint: 'Track purchase requests and history' },
  { id: 'fulfillment', label: 'Order Fulfillment', hint: 'Treat requests and register deliveries' },
];

function NavigationIcon({ id }: { id: string }) {
  if (id === 'home') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (id === 'catalog') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20M8 7h8M8 11h6"/></svg>;
  if (id === 'orders') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/><path d="m15 16 1.5 1.5L20 14"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="m6 11 2 2 4-4"/></svg>;
}

export default function Header({ onNavigate }: HeaderProps) {
  const user = useCurrentUser();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = useMemo(() => destinations.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSelectedIndex(0); setCommandOpen((value) => !value); }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    document.body.classList.add('weparts-command-open');
    return () => document.body.classList.remove('weparts-command-open');
  }, [commandOpen]);

  const go = (id: string) => { onNavigate(id); setCommandOpen(false); setQuery(''); };

  return (
    <header className="header">
      <div className="header-logo">
        <img src={weatherfordLogo} alt="Weatherford" />
        <div className="pra-label">
          WEPARTS · COMMERCIAL<span className="pra-sub">Customer ordering portal</span>
        </div>
      </div>
      <div className="header-spacer"></div>
      <div className="header-actions">
        {/* Search */}
        <div className="header-search" onClick={() => { setSelectedIndex(0); setCommandOpen(true); }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedIndex(0); setCommandOpen(true); } }} aria-label="Open quick navigation">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search or jump to..." readOnly tabIndex={-1} />
          <kbd>Ctrl K</kbd>
        </div>

        {/* Notifications */}
        <button className="header-icon-btn" title="Notifications">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="badge">1</span>
        </button>

        {/* Help */}
        <button className="header-icon-btn" title="Help">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
        </button>

        {/* User */}
        <div className="header-user">
          <div className="header-user-avatar" aria-label={user.fullName}>
            {user.photoUrl ? <img src={user.photoUrl} alt="" /> : user.initials}
          </div>
          <div className="header-user-name">
            {user.fullName}
            <span className="role">{user.subtitle}</span>
          </div>
        </div>
      </div>
      {commandOpen ? <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><div className="command-dialog" role="dialog" aria-modal="true" aria-label="Quick navigation"><div className="command-input"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex((value) => filtered.length ? (value + 1) % filtered.length : 0); } else if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex((value) => filtered.length ? (value - 1 + filtered.length) % filtered.length : 0); } else if (event.key === 'Enter' && filtered[selectedIndex]) { event.preventDefault(); go(filtered[selectedIndex].id); } }} placeholder="Where would you like to go?" /><kbd>ESC</kbd></div><div className="command-group"><span>QUICK NAVIGATION</span>{filtered.map((item, index) => <button className={index === selectedIndex ? 'selected' : ''} key={item.id} onMouseEnter={() => setSelectedIndex(index)} onClick={() => go(item.id)}><i><NavigationIcon id={item.id} /></i><div><b>{item.label}</b><small>{item.hint}</small></div><kbd>↵</kbd></button>)}{!filtered.length ? <div className="command-empty"><b>No destination found</b><span>Try searching for MPD or Home.</span></div> : null}</div><div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span>WeParts · Global Sales</span></div></div></div> : null}
    </header>
  );
}
