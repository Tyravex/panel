import { Activity, Blocks, Boxes, ClipboardList, FolderKanban, LayoutDashboard, ListTodo, Network, Settings, Shield, UserRound, Users, Wrench, Store, LockKeyhole, Share2, ChartNoAxesCombined, Globe2, MapPin, Upload, Library, GitBranch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarItem = { path?: string; label: string; icon: LucideIcon; permission?: string | readonly string[]; ownerOnly?: boolean; end?: boolean };
export type SidebarSection = { id: string; label: string; icon: LucideIcon; items: SidebarItem[] };

// Preserve existing routes/permissions; disabled items have no path.
export const adminSections: SidebarSection[] = [
  {
    id: "management", label: "Management", icon: Users, items: [
      { path: "/admin/users", label: "Users", icon: UserRound, permission: "user:read" },
      { path: "/admin/roles", label: "Roles & Permissions", icon: Shield, permission: "role:read" },
    ]
  },
  {
    id: "infrastructure", label: "Infrastructure", icon: Network, items: [
      { path: "/admin/regions", label: "Regions", icon: Globe2, permission: "region:manage" },
      { path: "/admin/locations", label: "Locations", icon: MapPin, permission: "location:manage" },
      { path: "/admin/nodes", label: "Nodes", icon: Network, permission: "node:read" },
      { path: "/admin/services", label: "Services", icon: Boxes, permission: "service:read:any" },
    ]
  },
  {
    id: "eggs", label: "Eggs System", icon: FolderKanban, items: [
      { path: "/admin/eggs", label: "Egg Library", icon: Library, permission: "egg:read", end: true },
      { path: "/admin/eggs/import", label: "Import Eggs", icon: Upload, permission: ["egg:read", "egg:import"] },
      { path: "/admin/eggs/repositories", label: "Egg Repositories", icon: GitBranch, permission: "egg:read" },
      { path: "/admin/eggs/tags", label: "Egg Tags", icon: FolderKanban, permission: "egg:read" },
    ]
  },
  {
    id: "operations", label: "Operations", icon: Activity, items: [
      { label: "Jobs", icon: ListTodo },
    ]
  },
  {
    id: "plugins", label: "Plugins", icon: Blocks, items: [
      { path: "/admin/plugins", label: "Plugins", icon: Blocks, permission: "plugin:read" },
      { path: "/admin/plugins/marketplace", label: "Marketplace", icon: Store, permission: "plugin:read" },
    ]
  },
  {
    id: "system", label: "System", icon: Settings, items: [
      { path: "/admin/audit", label: "Audit Logs", icon: ClipboardList, permission: "audit:read" },
      { path: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:read" },
      { label: "Maintenance", icon: Wrench },
      { label: "Security", icon: LockKeyhole },
    ]
  },
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
export const accountSection: SidebarSection = {
  id: "account", label: "Account", icon: UserRound, items: [
    { path: "/profile", label: "Profile", icon: UserRound },
    { path: "/settings", label: "Settings", icon: Settings },
  ]
};
