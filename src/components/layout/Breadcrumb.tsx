import { destinationFor, HOME_SCREEN, type ScreenName } from '../../config/navigation';

interface BreadcrumbProps {
  screen: ScreenName;
  onNavigate: (screen: string) => void;
}

/**
 * Answers "where am I". Uses the .breadcrumb styles already declared in
 * index.css, which had no consumer until now.
 *
 * Hidden on Home: the root does not need a trail back to itself.
 */
export default function Breadcrumb({ screen, onNavigate }: BreadcrumbProps) {
  const destination = destinationFor(screen);
  if (!destination || screen === HOME_SCREEN) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <a
        href="#"
        onClick={(event) => { event.preventDefault(); onNavigate(HOME_SCREEN); }}
      >
        WeParts Commercial
      </a>
      <span className="sep"> / </span>
      <span>{destination.area}</span>
      <span className="sep"> / </span>
      <span aria-current="page">{destination.label}</span>
    </nav>
  );
}
