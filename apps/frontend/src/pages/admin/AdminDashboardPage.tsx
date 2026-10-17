import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { SurfaceCard } from "@/shared/ui/SurfaceCard";

export const AdminDashboardPage = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">
            Tyravex / Administration
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            {t("admin.dashboard.title", {
              defaultValue: "Administration",
            })}
          </h1>

          <p className="mt-2 text-text-secondary">
            {t("admin.dashboard.description", {
              defaultValue: "Manage your Tyravex infrastructure.",
            })}
          </p>
        </div>

        <Link
          to="/dashboard"
          className="rounded-xl border border-border-subtle px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
        >
          {t("admin.dashboard.backToUser", {
            defaultValue: "Back to user dashboard",
          })}
        </Link>
      </div>

      <SurfaceCard>
        <h2 className="text-lg font-semibold">
          {t("admin.dashboard.overview", {
            defaultValue: "System overview",
          })}
        </h2>

        <p className="mt-2 text-sm text-text-secondary">
          {t("admin.dashboard.comingSoon", {
            defaultValue: "Administration modules will appear here.",
          })}
        </p>
      </SurfaceCard>
    </div>
  );
};
