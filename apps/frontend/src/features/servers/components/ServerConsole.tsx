import { HardDrive, Info, Send, Terminal, Users, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PreviewServer } from "@/features/servers/mock/servers.mock";

type ServerConsoleProps = {
    isDemoMode: boolean;
    previewServer?: PreviewServer;
};

const resourceItems = [
    { key: "cpu", color: "text-emerald-400" },
    { key: "memory", color: "text-blue-400" },
    { key: "disk", color: "text-purple-400" },
] as const;

export const ServerConsole = ({ isDemoMode, previewServer }: ServerConsoleProps) => {
    const { t } = useTranslation();
    const d = (key: string) => t(`dashboard.serverDetails.${key}`);

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <Terminal size={17} className="text-primary" aria-hidden="true" />{d("console")}
                    </h2>
                    <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <span className="size-2 rounded-full bg-slate-500" aria-hidden="true" />{d("notConnected")}
                    </span>
                </div>
                <div className="flex min-h-[500px] flex-col bg-[#080d16] p-4 sm:min-h-[620px]">
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <Terminal size={32} aria-hidden="true" className="text-text-secondary" />
                        <p className="text-sm font-medium text-text-primary">{d("consoleUnavailable")}</p>
                        <p className="max-w-sm text-xs leading-6 text-text-secondary">{d("consoleInfo")}</p>
                        {isDemoMode && (
                            <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">{d("demoConsole")}</span>
                        )}
                    </div>
                    <div className="mt-4 flex gap-2">
                        <input type="text" disabled placeholder={d("commandPlaceholder")} aria-label={d("consoleCommand")}
                            className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-slate-950 px-4 py-3 font-mono text-sm text-text-secondary outline-none disabled:cursor-not-allowed" />
                        <button type="button" disabled aria-label={d("sendCommand")}
                            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white opacity-50">
                            <Send size={17} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </section>
            <aside className="space-y-4">
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                        <Wifi size={17} className="text-primary" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-text-primary">{d("network")}</h2>
                    </div>
                    <div className="divide-y divide-border-subtle px-4">
                        <div className="flex items-center justify-between gap-3 py-3 text-sm">
                            <span className="text-text-secondary">{d("ipAddress")}</span>
                            <span className="text-text-primary">{d("notAvailable")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3 text-sm">
                            <span className="text-text-secondary">{d("port")}</span>
                            <span className="text-text-primary">{d("notAvailable")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3 text-sm">
                            <span className="text-text-secondary">{d("connection")}</span>
                            <span className="text-text-secondary">{d("notConnected")}</span>
                        </div>
                    </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                    <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <Users size={17} className="text-primary" aria-hidden="true" />{d("players")}
                        </h2>
                        {previewServer && (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                {previewServer.players} / {previewServer.maxPlayers}
                            </span>
                        )}
                    </div>
                    <div className="px-4 py-5 text-sm text-text-secondary">
                        {previewServer ? d("demoPlayers") : d("playersUnavailable")}
                    </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                        <HardDrive size={17} className="text-primary" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-text-primary">{d("resourceUsage")}</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3 p-4">
                        {resourceItems.map((resource) => (
                            <div key={resource.key} className="flex flex-col items-center gap-3">
                                <span className={`text-xs font-medium ${resource.color}`}>
                                    {resource.key === "cpu" ? "CPU" : d(resource.key)}
                                </span>
                                <div className="flex size-20 items-center justify-center rounded-full border-[6px] border-white/10">
                                    <span className="text-xs font-semibold text-text-secondary">N/A</span>
                                </div>
                                <span className="text-center text-xs text-text-secondary">{d("noData")}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface p-4 text-xs leading-5 text-text-secondary">
                    <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                    {d("resourceInfo")}
                </div>
            </aside>
        </div>
    );
};
