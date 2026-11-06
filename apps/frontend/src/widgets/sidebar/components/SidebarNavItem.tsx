import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SidebarItem } from "../config/navigation";

type Props = { item: SidebarItem; onNavigate?: () => void };
export function SidebarNavItem({ item, onNavigate }: Props) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(`navigation.${item.label.toLowerCase().replace(/\W+/g, "")}`, { defaultValue: item.label });
  const base = "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors";
  if (!item.path) return <div aria-disabled="true" title={t("sidebar.comingLater")} className={`${base} cursor-not-allowed text-text-secondary opacity-50`}><Icon size={17} aria-hidden="true" /><span>{label}</span><span className="ml-auto text-[10px]">{t("sidebar.soon")}</span></div>;
  return <NavLink to={item.path} end={item.path === "/admin" || item.path === "/admin/plugins"} onClick={onNavigate} className={({ isActive }) => `${base} ${isActive ? "bg-primary/15 text-primary" : "text-text-secondary hover:bg-white/5 hover:text-text-primary"}`}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>;
}
