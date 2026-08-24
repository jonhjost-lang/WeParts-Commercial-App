import type { UserProfile } from '../../config/accessControl';
import { destinationsFor } from '../../config/navigation';
import NavigationIcon from './NavigationIcon';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  profile: UserProfile;
}

export default function Sidebar({ activeScreen, onNavigate, profile }: SidebarProps) {
  return (
    <nav className="sidebar">

      {/* Workspace */}
      <div className="sidebar-section">
        <div className="sidebar-label">Workspace</div>
        {destinationsFor(profile).map((destination) => (
          <div
            key={destination.id}
            className={`nav-item${activeScreen === destination.id ? ' active' : ''}`}
            onClick={() => onNavigate(destination.id)}
          >
            <NavigationIcon id={destination.id} className="icon" />
            {destination.label}
          </div>
        ))}
      </div>
    </nav>
  );
}
