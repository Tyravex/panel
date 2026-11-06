import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/app/store/auth.store";
import { UserNavigation } from "@/features/navigation";
import { adminSections, accountSection } from "./config/navigation";
import type { SidebarItem, SidebarSection as Section } from "./config/navigation";
import { SidebarNavItem } from "./components/SidebarNavItem";
import { SidebarSection } from "./components/SidebarSection";
import { PanelSwitcher } from "./components/PanelSwitcher";
import { FavoriteServices } from "./components/FavoriteServices";
import { useSidebarSections } from "./hooks/useSidebarSections";

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const sections = useMemo(
    () => (isAdmin ? adminSections : [accountSection]),
    [isAdmin],
  );
  const { expanded, toggle } = useSidebarSections(sections);

  const visible = (item: SidebarItem) =>
    (!item.ownerOnly || !!user?.roles?.includes("Owner")) &&
    (!item.permission || !!user?.permissions?.includes(item.permission));

  const filtered: Section[] = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(visible),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={[
        "w-64 shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-surface px-4 py-4",
        mobile ? "flex h-full" : "sticky top-0 hidden h-dvh lg:flex",
      ].join(" ")}
    >
      <NavLink
        to={isAdmin ? "/admin" : "/dashboard"}
        onClick={onNavigate}
        className="flex shrink-0 items-center gap-3 px-3 pb-4"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-white">
          T
        </div>
        <span className="text-xl font-bold tracking-tight">tyravex</span>
      </NavLink>

      <nav
        aria-label={
          isAdmin
            ? t("sidebar.administrationNavigation")
            : t("sidebar.mainNavigation")
        }
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-4"
      >
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {isAdmin ? t("sidebar.administration") : t("sidebar.userPanel")}
        </p>

        {isAdmin ? (
          <SidebarNavItem
            item={{
              path: "/admin",
              label: "Overview",
              icon: adminSections[0].icon,
            }}
            onNavigate={onNavigate}
          />
        ) : (
          <UserNavigation onNavigate={onNavigate} />
        )}

        {filtered.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            open={expanded[section.id] ?? false}
            onToggle={() => toggle(section.id)}
            onNavigate={onNavigate}
          />
        ))}

        {!isAdmin && <FavoriteServices onNavigate={onNavigate} />}
      </nav>

      <footer className="shrink-0 space-y-3 border-t border-border-subtle pt-3">
        {/* The switch stays pinned to the bottom and navigates to real routes. */}
        <PanelSwitcher isAdmin={isAdmin} onNavigate={onNavigate} />
        <p className="px-3 text-xs text-text-secondary">Tyravex Panel</p>
      </footer>
    </aside>
  );
}
