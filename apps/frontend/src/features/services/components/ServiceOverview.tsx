import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

type ServiceOverviewProps = {
    kind: "service";
    name: string;
    id: string;
    category?: string | null;
};

export const ServiceOverview = ({
    name,
    id,
    category,
}: ServiceOverviewProps) => {
    const { t } = useTranslation();

    return (
        <section className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
            <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Layers size={24} aria-hidden="true" />
                </div>

                <div className="min-w-0 space-y-2">
                    <p className="text-sm text-text-secondary">{category}</p>

                    <h1 className="break-words text-2xl font-bold text-text-primary">
                        {name}
                    </h1>

                    <p className="break-all text-xs text-text-secondary">
                        {t("dashboard.services.serviceId")}: {id}
                    </p>
                </div>
            </div>
        </section>
    );
};
