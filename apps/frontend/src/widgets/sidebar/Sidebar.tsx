import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, LayoutDashboard } from "lucide-react";
import { hasAdminAccess } from "@/shared/lib/permissions";

import { useAuthStore } from "@/app/store/auth.store";

type NavigationItem = {
  path: string;
  labelKey: string;
  fallback: string;
};

const navigationItems: NavigationItem[] = [
  {
    path: "/dashboard",
    labelKey: "sidebar.dashboard",
    fallback: "Dashboard",
  },
  {
    path: "/profile",
    labelKey: "sidebar.profile",
    fallback: "Profile",
  },
  {
    path: "/settings",
    labelKey: "sidebar.settings",
    fallback: "Settings",
  },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export const Sidebar = ({
  mobile = false,
  onNavigate,
}: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const canAccessAdmin = hasAdminAccess(user);

  const isAdminPanel =
    location.pathname === "/admin" ||
    location.pathname.startsWith("/admin/");

  return (
    <aside
      className={[
        "w-64 shrink-0 flex-col border-r border-border-subtle bg-surface px-4 py-6",
        mobile ? "flex h-full" : "hidden min-h-screen lg:flex",
      ].join(" ")}
    >
      <NavLink
        to="/dashboard"
        className="mb-10 flex items-center gap-3 px-3"
        aria-label="Tyravex Dashboard"
        onClick={onNavigate}
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-white">
          T
        </div>

        <span className="text-xl font-bold tracking-tight">
          tyravex
        </span>
      </NavLink>

      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
              ].join(" ")
            }
            onClick={onNavigate}
          >
            {t(item.labelKey, {
              defaultValue: item.fallback,
            })}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4 pt-6">
        {canAccessAdmin && (
          <div className="border-t border-border-subtle pt-4">
            <NavLink
              to={isAdminPanel ? "/dashboard" : "/admin"}
              className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              onClick={onNavigate}
            >
              {isAdminPanel ? (
                <LayoutDashboard size={18} aria-hidden="true" />
              ) : (
                <ArrowLeftRight size={18} aria-hidden="true" />
              )}

              <span>
                {isAdminPanel
                  ? t("navigation.userPanel", {
                    defaultValue: "Panel użytkownika",
                  })
                  : t("navigation.adminPanel", {
                    defaultValue: "Panel administracyjny",
                  })}
              </span>
            </NavLink>
          </div>
        )}

        <div className="px-3">
          <p className="text-xs text-text-secondary">
            Tyravex Panel
          </p>
        </div>
      </div>
    </aside>
  );
};
