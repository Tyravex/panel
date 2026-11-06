import { ArrowLeftRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { hasAdminAccess } from "@/shared/lib/permissions";
import { useAuthStore } from "@/app/store/auth.store";

type Props = { isAdmin: boolean; onNavigate?: () => void };

export function PanelSwitcher({ isAdmin, onNavigate }: Props) {
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  if (!hasAdminAccess(user)) return null;

  const destination = isAdmin ? "/dashboard" : "/admin";

  return (
    <NavLink
      to={destination}
      onClick={onNavigate}
      aria-label={isAdmin ? t("sidebar.userPanel") : t("sidebar.adminPanel")}
      className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
    >
      <ArrowLeftRight size={18} aria-hidden="true" />
      <span>{isAdmin ? t("sidebar.userPanel") : t("sidebar.adminPanel")}</span>
    </NavLink>
  );
}
