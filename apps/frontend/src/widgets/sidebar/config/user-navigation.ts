import {
  Activity, FolderKanban, LayoutDashboard, LayoutGrid,
  ListChecks, UsersRound, ChartNoAxesCombined,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type UserNavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  disabled?: boolean;
};

// Only enable a route after its page and backend integration are ready.
export const userNavigation: readonly UserNavigationItem[] = [
  { id: 'overview', label: 'Przegląd', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'services', label: 'Wszystkie usługi', icon: LayoutGrid, disabled: true },
  { id: 'projects', label: 'Projekty i grupy', icon: FolderKanban, disabled: true },
  { id: 'shared', label: 'Współdzielone ze mną', icon: UsersRound, disabled: true },
  { id: 'operations', label: 'Operacje', icon: ListChecks, disabled: true },
  { id: 'activity', label: 'Historia aktywności', icon: Activity, disabled: true },
  { id: 'resources', label: 'Zasoby', icon: ChartNoAxesCombined, disabled: true },
];
