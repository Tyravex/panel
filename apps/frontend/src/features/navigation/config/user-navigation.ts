import { FolderKanban, LayoutDashboard, LayoutGrid, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type UserNavigationItem = {
  id: "overview" | "services" | "projects" | "shared";
  icon: LucideIcon;
  path?: string;
  disabled?: boolean;
};

// Enable only after a corresponding page/route exists.
export const userNavigation: readonly UserNavigationItem[] = [
  { id: "overview", icon: LayoutDashboard, path: "/dashboard" },
  { id: "services", icon: LayoutGrid, disabled: true },
  { id: "projects", icon: FolderKanban, disabled: true },
  { id: "shared", icon: UsersRound, disabled: true },
];
