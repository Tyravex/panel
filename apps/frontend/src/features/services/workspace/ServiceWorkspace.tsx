import { useState, type ReactNode } from "react";
import {
    Activity,
    Archive,
    Bot,
    CalendarClock,
    Cpu,
    FileText,
    Folder,
    Gamepad2,
    Headphones,
    Layers,
    List,
    Mic2,
    Puzzle,
    Settings2,
    Shield,
    Terminal,
    Users,
    Variable,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ServiceInstallationCenter } from "@/features/services/installation/components/ServiceInstallationCenter";
import { ServiceStatus } from "@/features/services/components/ServiceStatus";
import {
    getServiceKind,
    type ServiceKind,
    type ServiceSection,
} from "@/features/services/workspace/service-workspace.types";

type Tab = {
    id: ServiceSection;
    label: string;
    icon: LucideIcon;
};

const shared: Tab[] = [
    { id: "overview", label: "Przegląd", icon: Layers },
    { id: "console", label: "Konsola", icon: Terminal },
    { id: "files", label: "Pliki", icon: Folder },
];

const ending: Tab[] = [
    { id: "backups", label: "Kopie zapasowe", icon: Archive },
    { id: "schedules", label: "Harmonogramy", icon: CalendarClock },
    { id: "settings", label: "Ustawienia", icon: Settings2 },
];

const tabs: Record<ServiceKind, Tab[]> = {
    game: [
        ...shared,
        { id: "extensions", label: "Pluginy / mody", icon: Puzzle },
        { id: "players", label: "Gracze", icon: Users },
        ...ending,
    ],

    bot: [
        ...shared,
        {
            id: "environment",
            label: "Zmienne środowiskowe",
            icon: Variable,
        },
        { id: "logs", label: "Logi", icon: List },
        { id: "modules", label: "Moduły", icon: Puzzle },
        ...ending,
    ],

    voice: [
        ...shared,
        { id: "channels", label: "Kanały", icon: Mic2 },
        { id: "permissions", label: "Uprawnienia", icon: Shield },
        ...ending,
    ],

    other: [...shared, ...ending],
};

const kindMeta: Record<
    ServiceKind,
    {
        label: string;
        icon: LucideIcon;
        description: string;
    }
> = {
    game: {
        label: "Serwer gry",
        icon: Gamepad2,
        description: "Zarządzanie serwerem gry",
    },

    bot: {
        label: "Service Bot",
        icon: Bot,
        description: "Zarządzanie aplikacją i botem",
    },

    voice: {
        label: "Voice Service",
        icon: Headphones,
        description: "Zarządzanie serwerem głosowym",
    },

    other: {
        label: "Service",
        icon: Cpu,
        description: "Zarządzanie usługą",
    },
};

export interface ServiceWorkspaceProps {
    service: {
        id: string;
        name: string;
        category?: {
            key: string;
            name: string;
        } | null;
        installStatus?: string | null;
        server?: {
            status: string;
        } | null;
    };

    /**
     * Istniejący widok instalacji można przekazać do zakładki Przegląd.
     * Dzięki temu nie tracimy obecnej obsługi instalacji Service.
     */
    overview?: ReactNode;
}

export const ServiceWorkspace = ({
    service,
    overview,
}: ServiceWorkspaceProps) => {
    const kind = getServiceKind(service.category?.key);
    const meta = kindMeta[kind];
    const KindIcon = meta.icon;

    const [section, setSection] = useState<ServiceSection>("overview");

    const availableTabs = tabs[kind];

    const selected =
        availableTabs.find((tab) => tab.id === section) ??
        availableTabs[0];

    const selectedSection = selected.id;
    const SelectedIcon = selected.icon;
    const isInstalled = service.installStatus === "INSTALLED";

    return (
        <div className="space-y-4">
            {/* Nagłówek usługi */}
            <header className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div
                    className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
                    aria-hidden="true"
                />

                <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary">
                            <KindIcon size={31} aria-hidden="true" />
                        </div>

                        <div className="min-w-0 space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                {meta.label}
                            </p>

                            <h1 className="break-words text-2xl font-bold text-text-primary sm:text-3xl">
                                {service.name}
                            </h1>

                            <p className="text-sm text-text-secondary">
                                {service.category?.name ?? meta.description}
                            </p>

                            <p className="break-all font-mono text-xs text-text-secondary">
                                Service ID: {service.id}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <ServiceStatus
                            kind="installation"
                            status={service.installStatus}
                        />

                        {service.server?.status != null && (
                            <ServiceStatus
                                kind="runtime"
                                status={service.server.status}
                            />
                        )}
                    </div>
                </div>
            </header>

            {/* Nawigacja i zawartość */}
            {!isInstalled ? (
                <ServiceInstallationCenter
                    serviceName={service.name}
                    installStatus={service.installStatus}
                >
                    {overview}
                </ServiceInstallationCenter>
            ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
                    <nav
                        aria-label="Moduły usługi"
                        className="rounded-2xl border border-border-subtle bg-surface p-2"
                    >
                        <div className="mb-2 border-b border-border-subtle px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            {meta.label}
                        </div>

                        <div className="flex gap-1 overflow-x-auto lg:flex-col">
                            {availableTabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = selectedSection === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSection(tab.id)}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors lg:w-full ${active
                                            ? "bg-primary/15 font-semibold text-primary"
                                            : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                                            }`}
                                    >
                                        <Icon size={17} aria-hidden="true" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    <main className="min-w-0 space-y-4">
                        {selectedSection === "overview" ? (
                            <>
                                {/* Karty przeglądu */}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                                        <Activity
                                            className="mb-3 text-primary"
                                            size={20}
                                            aria-hidden="true"
                                        />

                                        <p className="text-xs text-text-secondary">
                                            Instalacja
                                        </p>

                                        <p className="mt-1 font-semibold text-text-primary">
                                            {service.installStatus ?? "Brak danych"}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                                        <Cpu
                                            className="mb-3 text-primary"
                                            size={20}
                                            aria-hidden="true"
                                        />

                                        <p className="text-xs text-text-secondary">
                                            Zasoby CPU / RAM
                                        </p>

                                        <p className="mt-1 font-semibold text-text-primary">
                                            Brak telemetrii
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                                        <FileText
                                            className="mb-3 text-primary"
                                            size={20}
                                            aria-hidden="true"
                                        />

                                        <p className="text-xs text-text-secondary">
                                            Typ usługi
                                        </p>

                                        <p className="mt-1 font-semibold text-text-primary">
                                            {meta.label}
                                        </p>
                                    </div>
                                </div>

                                {/* Obecna obsługa instalacji */}
                                {overview}
                            </>
                        ) : (
                            <section className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                                        <SelectedIcon
                                            size={22}
                                            aria-hidden="true"
                                        />
                                    </div>

                                    <div>
                                        <h2 className="text-lg font-semibold text-text-primary">
                                            {selected.label}
                                        </h2>

                                        <p className="text-sm text-text-secondary">
                                            {meta.label}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-xl border border-border-subtle bg-primary/5 p-5">
                                    <p className="font-medium text-text-primary">
                                        Moduł oczekuje na integrację
                                    </p>

                                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                                        Ten widok jest częścią nowego panelu Service.
                                        Operacje na procesie, plikach i zasobach wymagają
                                        rzeczywistego API i uprawnień. Nie są tutaj symulowane.
                                    </p>

                                    {selectedSection === "extensions" && (
                                        <p className="mt-3 text-sm text-text-secondary">
                                            Instalator pluginów i modów będzie udostępniany
                                            wyłącznie dla zgodnych gier, silników i wersji —
                                            po weryfikacji możliwości usługi.
                                        </p>
                                    )}

                                    {(selectedSection === "channels" ||
                                        selectedSection === "permissions") && (
                                            <p className="mt-3 text-sm text-text-secondary">
                                                Zarządzanie TeamSpeak 3 będzie wymagało
                                                autoryzowanej integracji ServerQuery.
                                            </p>
                                        )}
                                </div>
                            </section>
                        )}
                    </main>
                </div>
            )}
        </div>
    );
};
