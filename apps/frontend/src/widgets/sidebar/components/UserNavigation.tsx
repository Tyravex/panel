import { NavLink } from 'react-router-dom';
import { userNavigation } from '../config/user-navigation';

interface UserNavigationProps {
  onNavigate?: () => void;
}

export function UserNavigation({ onNavigate }: UserNavigationProps) {
  return (
    <nav aria-label="Nawigacja użytkownika" className="flex flex-col gap-1">
      {userNavigation.map(({ id, label, icon: Icon, path, disabled }) => {
        const base = 'flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors';
        if (disabled || !path) {
          return (
            <div
              key={id}
              aria-disabled="true"
              title="Funkcja w przygotowaniu"
              className={`${base} cursor-not-allowed text-text-secondary opacity-50`}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="shrink-0 text-[10px]">Wkrótce</span>
            </div>
          );
        }
        return (
          <NavLink
            key={id}
            to={path}
            end
            onClick={onNavigate}
            className={({ isActive }) => `${base} ${isActive
              ? 'bg-primary/15 font-semibold text-primary'
              : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
