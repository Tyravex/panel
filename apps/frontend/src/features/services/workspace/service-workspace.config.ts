import {
    Archive, Bot, CalendarClock, Cpu, Folder, Gamepad2, Headphones,
    Layers, List, Mic2, Puzzle, Settings2, Shield, Terminal, Users, Variable,
    type LucideIcon,
} from 'lucide-react';
import type { ServiceKind, ServiceSection } from './service-workspace.types';

export type ServiceTab = { id: ServiceSection; icon: LucideIcon };

const shared: ServiceTab[] = [
    { id: 'overview', icon: Layers },
    { id: 'console', icon: Terminal },
    { id: 'files', icon: Folder },
];
const ending: ServiceTab[] = [
    { id: 'backups', icon: Archive },
    { id: 'schedules', icon: CalendarClock },
    { id: 'settings', icon: Settings2 },
];

export const serviceTabs: Record<ServiceKind, ServiceTab[]> = {
    game: [...shared, { id: 'extensions', icon: Puzzle }, { id: 'players', icon: Users }, ...ending],
    bot: [...shared, { id: 'environment', icon: Variable }, { id: 'logs', icon: List }, { id: 'modules', icon: Puzzle }, ...ending],
    voice: [...shared, { id: 'channels', icon: Mic2 }, { id: 'permissions', icon: Shield }, ...ending],
    other: [...shared, ...ending],
};

export const serviceKindIcons: Record<ServiceKind, LucideIcon> = {
    game: Gamepad2, bot: Bot, voice: Headphones, other: Cpu,
};

export const serviceKindStyles: Record<ServiceKind, string> = {
    game: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
    bot: 'border-sky-400/30 bg-sky-400/10 text-sky-400',
    voice: 'border-violet-400/30 bg-violet-400/10 text-violet-400',
    other: 'border-primary/30 bg-primary/10 text-primary',
};
