import { Link, useLocation } from 'react-router-dom';
import { IconChart, IconSearch, IconSettings, IconToday } from './icons';

const ITEMS = [
  { to: '/today', label: 'Today', Icon: IconToday },
  { to: '/foods', label: 'Foods', Icon: IconSearch },
  { to: '/history', label: 'History', Icon: IconChart },
  { to: '/settings', label: 'Settings', Icon: IconSettings }
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map(({ to, label, Icon }) => {
        const active =
          to === '/today'
            ? pathname === '/today' || pathname.startsWith('/day/')
            : pathname === to || pathname.startsWith(`${to}/`);

        return (
          <Link
            key={to}
            to={to}
            className={`nav-item${active ? ' nav-item-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
