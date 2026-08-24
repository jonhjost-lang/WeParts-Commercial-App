import { useEffect, useMemo, useState } from 'react';
import weatherfordLogo from '../../assets/logo-wtfd.png';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { UserProfile } from '../../config/accessControl';
import { destinationsFor } from '../../config/navigation';
import NavigationIcon from './NavigationIcon';

interface HeaderProps {
  onNavigate: (screen: string) => void;
  profile: UserProfile;
}

export default function Header({ onNavigate, profile }: HeaderProps) {
  const user = useCurrentUser();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Gated by profile before the text filter: the palette must never navigate
  // to a screen the Sidebar hides.
  const destinations = useMemo(() => destinationsFor(profile), [profile]);
  const filtered = useMemo(
    () => destinations.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())),
    [destinations, query],
  );

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
