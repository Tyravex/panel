import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowLeftRight,
  Blocks,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Network,
  Server,
  Settings,
  Shield,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { hasAdminAccess } from "@/shared/lib/permissions";
import { useAuthStore } from "@/app/store/auth.store";

type Item = {
  path?: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  ownerOnly?: boolean;
};

type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: Item[];
};

const adminSections: Section[] = [
  {
    id: "management",
    label: "Management",
    icon: Users,
    items: [
      {
        path: "/admin/users",
        label: "Users",
        icon: UserRound,
        permission: "user:read",
      },
      {
        path: "/admin/roles",
        label: "Roles & Permissions",
        icon: Shield,
        permission: "role:manage",
      },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: Network,
    items: [
      {
        path: "/admin/nodes",
        label: "Nodes",
        icon: Network,
        permission: "node:manage",
      },
      {
        label: "Servers",
        icon: Server,
      },
      {
        path: "/admin/services",
        label: "Services",
        icon: Boxes,
        permission: "service:manage:any",
        ownerOnly: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    items: [
      {
        label: "Jobs",
        icon: ListTodo,
      },
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: Blocks,
    items: [
      {
        path: "/admin/plugins",
        label: "Plugins",
        icon: Blocks,
        permission: "plugin:manage",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      {
        path: "/admin/audit",
        label: "Audit Logs",
        icon: ClipboardList,
        permission: "role:manage",
      },
      {
        path: "/admin/settings",
        label: "Settings",
        icon: Settings,
        permission: "user:manage",
      },
      {
        label: "Maintenance",
        icon: Wrench,
      },
      {
        label: "Security",
        icon: LockKeyhole,
      },
    ],
  },
];

const userSections: Section[] = [
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    items: [
      {
        path: "/profile",
        label: "Profile",
        icon: UserRound,
      },
      {
        path: "/settings",
        label: "Settings",
        icon: Settings,
      },
    ],
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

  const isAdmin =
    location.pathname === "/admin" ||
    location.pathname.startsWith("/admin/");

  const sections = isAdmin ? adminSections : userSections;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    management: true,
    infrastructure: false,
    operations: false,
    plugins: false,
    system: false,
    account: true,
  });

  useEffect(() => {
    const active = sections.find((section) =>
      section.items.some(
        (item) => item.path === location.pathname,
      ),
    );

    if (active) {
      setExpanded((previous) =>
        previous[active.id]
          ? previous
          : {
            ...previous,
            [active.id]: true,
          },
      );
    }
  }, [location.pathname, isAdmin]);

  const visible = (item: Item) =>
    (!item.ownerOnly ||
      !!user?.roles?.includes("Owner")) &&
    (!item.permission ||
      !!user?.permissions?.includes(item.permission));

  const translateLabel = (label: string) =>
    t(
      `navigation.${label
        .toLowerCase()
        .replace(/\W+/g, "")}`,
      {
        defaultValue: label,
      },
    );

  const linkClass = ({
    isActive,
  }: {
    isActive: boolean;
  }) =>
    [
      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary/15 text-primary"
        : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
    ].join(" ");

  const renderItem = (item: Item) => {
    const Icon = item.icon;

    if (!item.path) {
      return (
        <div
          key={item.label}
          aria-disabled="true"
          title={t("sidebar.comingLater")}
          className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text-secondary opacity-50"
        >
          <Icon size={17} aria-hidden="true" />

          <span>
            {translateLabel(item.label)}
          </span>

          <span className="ml-auto text-[10px]">
            {t("sidebar.soon")}
          </span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/admin"}
        onClick={onNavigate}
        className={linkClass}
      >
        <Icon size={17} aria-hidden="true" />

        <span>
          {translateLabel(item.label)}
        </span>
      </NavLink>
    );
  };

  return (
    <aside
      className={[
        "w-64 shrink-0 flex-col border-r border-border-subtle bg-surface px-4 py-6",
        mobile
          ? "flex h-full"
          : "hidden min-h-screen lg:flex",
      ].join(" ")}
    >
      <NavLink
        to={isAdmin ? "/admin" : "/dashboard"}
        className="mb-8 flex items-center gap-3 px-3"
        onClick={onNavigate}
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-white">
          T
        </div>

        <span className="text-xl font-bold tracking-tight">
          tyravex
        </span>
      </NavLink>

      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {isAdmin
          ? t("sidebar.administration")
          : t("sidebar.userPanel")}
      </p>

      <nav
        aria-label={
          isAdmin
            ? t("sidebar.administrationNavigation")
            : t("sidebar.mainNavigation")
        }
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4"
      >
        {renderItem({
          path: isAdmin ? "/admin" : "/dashboard",
          label: "Overview",
          icon: LayoutDashboard,
        })}

        {sections.map((section) => {
          const items = section.items.filter(visible);

          if (!items.length) {
            return null;
          }

          const SectionIcon = section.icon;
          const open = expanded[section.id] ?? false;

          return (
            <div
              key={section.id}
              className="border-t border-border-subtle pt-2"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`sidebar-${section.id}`}
                onClick={() =>
                  setExpanded((previous) => ({
                    ...previous,
                    [section.id]: !open,
                  }))
                }
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                <SectionIcon
                  size={15}
                  aria-hidden="true"
                />

                <span className="flex-1">
                  {t(`sidebar.sections.${section.id}`)}
                </span>

                {open ? (
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                  />
                )}
              </button>

              {open && (
                <div
                  id={`sidebar-${section.id}`}
                  className="mt-1 flex flex-col gap-1 pl-2"
                >
                  {items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t border-border-subtle pt-4">
        {hasAdminAccess(user) && (
          <NavLink
            to={
              isAdmin
                ? "/dashboard"
                : "/admin"
            }
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ArrowLeftRight
              size={18}
              aria-hidden="true"
            />

            <span>
              {isAdmin
                ? t("sidebar.userPanel")
                : t("sidebar.adminPanel")}
            </span>
          </NavLink>
        )}

        <p className="px-3 text-xs text-text-secondary">
          Tyravex Panel
        </p>
      </div>
    </aside>
  );
};
