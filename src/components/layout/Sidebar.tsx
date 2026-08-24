import type { UserProfile } from '../../config/accessControl';
import { areasFor } from '../../config/navigation';
import NavigationIcon from './NavigationIcon';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  profile: UserProfile;
}

export default function Sidebar({ activeScreen, onNavigate, profile }: SidebarProps) {
  return (
    <nav className="sidebar">
      {areasFor(profile).map(({ area, destinations }) => (
        <div className="sidebar-section" key={area}>
          <div className="sidebar-label">{area}</div>
          {destinations.map((destination) => (
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
      ))}
    </nav>
  );
}
