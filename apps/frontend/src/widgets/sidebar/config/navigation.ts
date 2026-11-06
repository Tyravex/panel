import { Activity, Blocks, Boxes, ClipboardList, FolderKanban, LayoutDashboard, ListTodo, Network, Server, Settings, Shield, UserRound, Users, Wrench, Store, LockKeyhole, Share2, ChartNoAxesCombined } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarItem = { path?: string; label: string; icon: LucideIcon; permission?: string; ownerOnly?: boolean };
export type SidebarSection = { id: string; label: string; icon: LucideIcon; items: SidebarItem[] };

// Preserve existing routes/permissions; disabled items have no path.
export const adminSections: SidebarSection[] = [
  { id: "management", label: "Management", icon: Users, items: [
    { path: "/admin/users", label: "Users", icon: UserRound, permission: "user:read" },
    { path: "/admin/roles", label: "Roles & Permissions", icon: Shield, permission: "role:manage" },
  ] },
  { id: "infrastructure", label: "Infrastructure", icon: Network, items: [
    { path: "/admin/nodes", label: "Nodes", icon: Network, permission: "node:manage" },
    { label: "Servers", icon: Server }, // legacy placeholder; Service is canonical
    { path: "/admin/services", label: "Services", icon: Boxes, permission: "service:manage:any", ownerOnly: true },
  ] },
  { id: "operations", label: "Operations", icon: Activity, items: [
    { label: "Jobs", icon: ListTodo },
  ] },
  { id: "plugins", label: "Plugins", icon: Blocks, items: [
    { path: "/admin/plugins", label: "Plugins", icon: Blocks, permission: "plugin:manage" },
    { path: "/admin/plugins/marketplace", label: "Marketplace", icon: Store, permission: "plugin:manage" },
  ] },
  { id: "system", label: "System", icon: Settings, items: [
    { path: "/admin/audit", label: "Audit Logs", icon: ClipboardList, permission: "role:manage" },
    { path: "/admin/settings", label: "Settings", icon: Settings, permission: "user:manage" },
    { label: "Maintenance", icon: Wrench },
    { label: "Security", icon: LockKeyhole },
  ] },
];

export const userItems: SidebarItem[] = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
  // Confirm these routes in your router before enabling them:
  { label: "All services", icon: Boxes },
  { label: "Projects & groups", icon: FolderKanban },
  { label: "Shared with me", icon: Share2 },
  { label: "Operations", icon: ListTodo },
  { label: "Activity history", icon: Activity },
  { label: "Resources", icon: ChartNoAxesCombined },
];
export const accountSection: SidebarSection = { id: "account", label: "Account", icon: UserRound, items: [
  { path: "/profile", label: "Profile", icon: UserRound },
  { path: "/settings", label: "Settings", icon: Settings },
] };
