import { Layers, Play, RotateCcw, Skull, Square, Users } from "lucide-react";
import { ServiceStatus } from "@/features/services/components/ServiceStatus";
import { useTranslation } from "react-i18next";

type ServerOverviewProps = {
    kind: "server";
    name: string;
    id: number;
    status?: string | null;
    isDemoMode: boolean;
    preview?: {
        image: string;
        game: string;
        version: string;
        players: number;
        maxPlayers: number;
    };
};

type ServiceOverviewProps = {
    kind: "service";
    name: string;
    id: string;
    category?: string | null;
};

type ServiceOverviewPropsUnion = ServerOverviewProps | ServiceOverviewProps;

export const ServiceOverview = (props: ServiceOverviewPropsUnion) => {
    const { t } = useTranslation();

    if (props.kind === "service") {
        return (
            <section className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Layers size={24} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-2">
                        <p className="text-sm text-text-secondary">{props.category}</p>
                        <h1 className="break-words text-2xl font-bold text-text-primary">
                            {props.name}
                        </h1>
                        <p className="break-all text-xs text-text-secondary">
                            {t("dashboard.services.serviceId")}: {props.id}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const d = (key: string) => t(`dashboard.serverDetails.${key}`);

    return (
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
            <div className="relative min-h-56 bg-slate-950">
                {props.preview ? (
                    <img
                        src={props.preview.image}
                        alt={props.preview.game}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-slate-900 to-slate-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                <div className="relative flex min-h-56 flex-col justify-end gap-5 p-5 sm:p-7">
                    <div>
                        {props.isDemoMode && (
                            <span className="mb-3 inline-flex rounded-full border border-primary/40 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-primary">
                                {d("demoBadge")}
                            </span>
                        )}
                        <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">
                            {props.name}
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <ServiceStatus kind="runtime" status={props.status} />
                            {props.preview && (
                                <>
                                    <span className="rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">
                                        {props.preview.version}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">
                                        <Users size={14} aria-hidden="true" />
                                        {props.preview.players} / {props.preview.maxPlayers}
                                    </span>
                                </>
                            )}
                            <span className="rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">
                                ID: {props.id}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" disabled title={d("powerUnavailable")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                                <Play size={15} aria-hidden="true" />{d("start")}
                            </button>
                            <button type="button" disabled title={d("powerUnavailable")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                                <RotateCcw size={15} aria-hidden="true" />{d("restart")}
                            </button>
                            <button type="button" disabled title={d("powerUnavailable")} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                                <Square size={14} aria-hidden="true" />{d("stop")}
                            </button>
                            <button type="button" disabled title={d("forceStopUnavailable")} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950 px-4 py-2 text-sm font-semibold text-rose-300 opacity-50">
                                <Skull size={15} aria-hidden="true" />{d("kill")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
