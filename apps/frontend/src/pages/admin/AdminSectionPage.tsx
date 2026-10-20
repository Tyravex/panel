import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface AdminSectionPageProps {
  title: string;
  description: string;
  planned?: boolean;
}

export const AdminSectionPage = ({
  title,
  description,
  planned = false,
}: AdminSectionPageProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">
          {t("admin.section.breadcrumb")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-text-secondary">{description}</p>
      </div>

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <p className="font-semibold">
          {planned
            ? t("admin.section.moduleInDevelopment")
            : t("admin.section.workspace")}
        </p>

        <p className="mt-2 text-sm text-text-secondary">
          {planned
            ? t("admin.section.notAvailableYet")
            : t("admin.section.selectSidebar")}
        </p>

        <Link
          to="/admin/users"
          className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
        >
          {t("admin.section.openUserManagement")}
        </Link>
      </section>
    </div>
  );
};
