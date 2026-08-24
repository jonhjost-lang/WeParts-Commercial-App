import type { ScreenName } from '../../config/navigation';

interface NavigationIconProps {
  id: ScreenName;
  className?: string;
}

export default function NavigationIcon({ id, className }: NavigationIconProps) {
  const shared = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

  if (id === 'home') {
    return <svg {...shared}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
  }
  if (id === 'catalog') {
    return <svg {...shared}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20M8 7h8M8 11h6" /></svg>;
  }
  if (id === 'orders') {
    return <svg {...shared}><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /><path d="m15 16 1.5 1.5L20 14" /></svg>;
  }
  if (id === 'po-templates') {
    return <svg {...shared}><path d="M4 4h9l4 4v12H4z" /><path d="M13 4v4h4" /><path d="M7 12h7M7 16h5" /></svg>;
  }
  return <svg {...shared}><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /><path d="m6 11 2 2 4-4" /></svg>;
}
