import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, LayoutDashboard, Users, Shield, Server, Network, Boxes, ListTodo, UserRound, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { hasAdminAccess } from "@/shared/lib/permissions";
import { useAuthStore } from "@/app/store/auth.store";

type Item = { path: string; label: string; icon: LucideIcon; permission?: string };
const userItems: Item[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/profile", label: "Profile", icon: UserRound },
  { path: "/settings", label: "Settings", icon: Settings },
];
const adminItems: Item[] = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/users", label: "Users", icon: Users, permission: "user:read" },
  { path: "/admin/roles", label: "Roles & Permissions", icon: Shield, permission: "role:manage" },
  { path: "/admin/nodes", label: "Nodes", icon: Network, permission: "node:manage" },
];
// These modules are not linked until their exact backend permission contracts are confirmed.
const plannedItems = [
  { label: "Servers", icon: Server },
  { label: "Services", icon: Boxes },
  { label: "Jobs", icon: ListTodo },
];
interface SidebarProps { mobile?: boolean; onNavigate?: () => void }
export const Sidebar = ({ mobile = false, onNavigate }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const items = isAdmin ? adminItems.filter((item) => !item.permission || !!user?.permissions?.includes(item.permission)) : userItems;
  return (
    <aside className={["w-64 shrink-0 flex-col border-r border-border-subtle bg-surface px-4 py-6", mobile ? "flex h-full" : "hidden min-h-screen lg:flex"].join(" ")}>
      <NavLink to={isAdmin ? "/admin" : "/dashboard"} className="mb-10 flex items-center gap-3 px-3" onClick={onNavigate}>
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-white">T</div>
        <span className="text-xl font-bold tracking-tight">tyravex</span>
      </NavLink>
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">{isAdmin ? "Administration" : "Workspace"}</p>
      <nav aria-label={isAdmin ? "Administration navigation" : "Main navigation"} className="flex flex-col gap-1">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === "/admin"} onClick={onNavigate} className={({ isActive }) => ["flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors", isActive ? "bg-primary/15 text-primary" : "text-text-secondary hover:bg-white/5 hover:text-text-primary"].join(" ")}>
            <Icon size={18} aria-hidden="true" /><span>{t(`navigation.${label.toLowerCase().replace(/\W+/g, "")}`, { defaultValue: label })}</span>
          </NavLink>
        ))}
      </nav>
      {isAdmin && <div className="mt-7 border-t border-border-subtle pt-5"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Planned modules</p>{plannedItems.map(({ label, icon: Icon }) => <div key={label} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm text-text-secondary opacity-50" title="Coming in a later development stage"><Icon size={18} aria-hidden="true" />{label}<span className="ml-auto text-[10px]">Soon</span></div>)}</div>}
      <div className="mt-auto space-y-4 pt-6">
        {hasAdminAccess(user) && <div className="border-t border-border-subtle pt-4"><NavLink to={isAdmin ? "/dashboard" : "/admin"} onClick={onNavigate} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20">{isAdmin ? <LayoutDashboard size={18} /> : <ArrowLeftRight size={18} />}<span>{isAdmin ? "User panel" : "Admin panel"}</span></NavLink></div>}
        <p className="px-3 text-xs text-text-secondary">Tyravex Panel</p>
      </div>
    </aside>
  );
};
