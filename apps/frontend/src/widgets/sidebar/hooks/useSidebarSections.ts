import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SidebarSection } from "../config/navigation";

export function useSidebarSections(sections: SidebarSection[]) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ management: true, account: true, favorites: true });
  useEffect(() => {
    const active = sections.find(section => section.items.some(item => item.path === pathname));
    if (active) setExpanded(previous => previous[active.id] ? previous : { ...previous, [active.id]: true });
  }, [pathname, sections]);
  const toggle = (id: string) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }));
  return { expanded, toggle };
}
