import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SidebarSection as Section } from "../config/navigation";
import { SidebarNavItem } from "./SidebarNavItem";

type Props = { section: Section; open: boolean; onToggle: () => void; onNavigate?: () => void };
export function SidebarSection({ section, open, onToggle, onNavigate }: Props) {
  const { t } = useTranslation();
  const Icon = section.icon;
  if (!section.items.length) return null;
  return <section className="border-t border-border-subtle pt-2"><button type="button" aria-expanded={open} aria-controls={`sidebar-${section.id}`} onClick={onToggle} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary hover:bg-white/5 hover:text-text-primary"><Icon size={15} aria-hidden="true"/><span className="flex-1">{t(`sidebar.sections.${section.id}`, { defaultValue: section.label })}</span>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>{open && <div id={`sidebar-${section.id}`} className="mt-1 flex flex-col gap-1 pl-2">{section.items.map(item => <SidebarNavItem key={item.path ?? item.label} item={item} onNavigate={onNavigate}/>)}</div>}</section>;
}
