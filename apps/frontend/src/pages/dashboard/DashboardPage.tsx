import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Boxes,
  Eye,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getUserServers } from "@/features/servers/api/servers.api";
import {
  previewServers,
  type PreviewServer,
} from "@/features/servers/mock/servers.mock";
import { getUserServices } from "@/features/services/api/services.api";
import { useUser } from "@/shared/store/user";

type ServiceCategory = "server" | "discord_bot" | "telegram_bot" | "other";

const getStatusStyles = (status?: string | null) => {
  switch (status?.toLowerCase()) {
    case "online":
      return {
        label: "Online",
        badge: "border-emerald-500/40 bg-emerald-950/90 text-emerald-400",
        dot: "bg-emerald-400",
      };
    case "offline":
      return {
        label: "Offline",
        badge: "border-rose-500/40 bg-rose-950/90 text-rose-400",
        dot: "bg-rose-400",
      };
    case "maintenance":
      return {
        label: "Maintenance",
        badge: "border-amber-500/40 bg-amber-950/90 text-amber-400",
        dot: "bg-amber-400",
      };
    default:
      return {
        label: status || "Unknown",
        badge: "border-slate-500/40 bg-slate-950/90 text-slate-300",
        dot: "bg-slate-400",
      };
  }
};

export const DashboardPage = () => {
  const user = useUser((state) => state.user);
  const { t } = useTranslation();

  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("server");
  const [previewMode, setPreviewMode] = useState(false);

  const {
    data: servers,
    isPending: areServersPending,
    isError: areServersError,
    isFetching: areServersFetching,
    refetch: refetchServers,
  } = useQuery({
    queryKey: ["user-servers", user?.id],
    queryFn: getUserServers,
    enabled: Boolean(user) && activeCategory === "server" && !previewMode,
    retry: 1,
    staleTime: 30_000,
  });

  const {
    data: services,
    isPending: areServicesPending,
    isError: areServicesError,
    isFetching: areServicesFetching,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ["user-services", user?.id],
    queryFn: getUserServices,
    enabled: Boolean(user) && activeCategory !== "server",
    retry: 1,
    staleTime: 30_000,
  });

  if (!user) return null;

  const categories = [
    {
      id: "server" as const,
      label: t("dashboard.categories.servers", {
        defaultValue: "Servers",
      }),
      icon: Server,
    },
    {
      id: "discord_bot" as const,
      label: t("dashboard.categories.discordBots", {
        defaultValue: "Discord Bots",
      }),
      icon: Bot,
    },
    {
      id: "telegram_bot" as const,
      label: t("dashboard.categories.telegramBots", {
        defaultValue: "Telegram Bots",
      }),
      icon: Send,
    },
    {
      id: "other" as const,
      label: t("dashboard.categories.other", {
        defaultValue: "Other Services",
      }),
      icon: Boxes,
    },
  ];

  const activeCategoryConfig = categories.find(
    (category) => category.id === activeCategory,
  );

  const ActiveCategoryIcon = activeCategoryConfig?.icon ?? Boxes;
  const activeCategoryLabel = activeCategoryConfig?.label ?? "";

  const isServerCategory = activeCategory === "server";
  const isPreviewActive = isServerCategory && previewMode;

  const displayedServers = isPreviewActive ? previewServers : servers;

  const isPending = isServerCategory
    ? !isPreviewActive && areServersPending
    : areServicesPending;

  const isError = isServerCategory
    ? !isPreviewActive && areServersError
    : areServicesError;

  const isFetching = isServerCategory
    ? !isPreviewActive && areServersFetching
    : areServicesFetching;

  const categoryServices = isServerCategory
    ? []
    : (services ?? []).filter(
        (service) => service.category.key === activeCategory,
      );

  const isEmpty = isServerCategory
    ? !displayedServers?.length
    : categoryServices.length === 0;

  const handleRefresh = () => {
    if (isServerCategory) {
      if (!previewMode) {
        void refetchServers();
      }
    } else {
      void refetchServices();
    }
  };

  const renderServerCard = (server: {
    id: number;
    name: string;
    status?: string | null;
  }) => {
    const status = getStatusStyles(server.status);

    const previewServer = isPreviewActive
      ? (server as PreviewServer)
      : null;

    const cardContent = (
      <>
        <div className="relative aspect-[2.67/1] overflow-hidden bg-slate-900">
          {previewServer?.image ? (
            <img
              src={previewServer.image}
              alt={previewServer.game}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-slate-900 to-slate-950">
              <Server size={40} aria-hidden="true" className="text-primary/60" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/30" />

          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md ${status.badge}`}
            >
              <span
                className={`size-2 rounded-full ${status.dot}`}
                aria-hidden="true"
              />
              {status.label}
            </span>

            {previewServer?.version && (
              <span className="rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                {previewServer.version}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-text-primary">
                {server.name}
              </h4>

              <p className="mt-1 text-sm text-text-secondary">
                {previewServer?.game ??
                  t("dashboard.categories.servers", {
                    defaultValue: "Servers",
                  })}
              </p>
            </div>

            <ArrowRight
              size={20}
              aria-hidden="true"
              className="shrink-0 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-subtle pt-3 text-xs text-text-secondary">
            {previewServer && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} aria-hidden="true" />
                {previewServer.players} / {previewServer.maxPlayers}
              </span>
            )}

            <span className="inline-flex items-center gap-1.5">
              <Server size={14} aria-hidden="true" />
              {t("dashboard.servers.serverId", {
                defaultValue: "Server ID",
              })}
              : {server.id}
            </span>
          </div>
        </div>
      </>
    );

    if (isPreviewActive) {
      return (
        <div
          key={server.id}
          className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface transition-colors hover:border-primary/50"
        >
          {cardContent}
        </div>
      );
    }

    return (
      <Link
        key={server.id}
        to={`/servers/${server.id}?demo=1`}
        className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {cardContent}
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-16 size-48 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <ShieldCheck size={14} aria-hidden="true" />
            Tyravex Panel
          </div>

          <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {t("dashboard.welcome", {
              defaultValue: "Welcome, {{username}}!",
              username: user.username || "User",
            })}
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
            {t("dashboard.services.description", {
              defaultValue:
                "Manage your servers, bots, and hosted services in one place.",
            })}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <UserRound size={17} aria-hidden="true" />
              {t("sidebar.profile", { defaultValue: "Profile" })}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>

            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-white/5 px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/10"
            >
              <Settings2 size={17} aria-hidden="true" />
              {t("sidebar.settings", { defaultValue: "Settings" })}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="services-heading">
        <div>
          <h2
            id="services-heading"
            className="text-lg font-semibold text-text-primary"
          >
            {t("dashboard.services.title", {
              defaultValue: "Your services",
            })}
          </h2>

          <p className="mt-1 text-sm text-text-secondary">
            {t("dashboard.services.subtitle", {
              defaultValue: "Choose a category to view your services.",
            })}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={t("dashboard.services.categoryLabel", {
            defaultValue: "Service categories",
          })}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                id={`service-tab-${category.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="service-category-panel"
                onClick={() => setActiveCategory(category.id)}
                className={`flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-colors sm:min-h-28 ${
                  isActive
                    ? "border-primary/50 bg-primary/10 text-text-primary"
                    : "border-border-subtle bg-surface text-text-secondary hover:border-primary/30 hover:text-text-primary"
                }`}
              >
                <Icon
                  size={23}
                  aria-hidden="true"
                  className={isActive ? "text-primary" : ""}
                />
                <span className="text-sm font-semibold">
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="service-category-panel"
          role="tabpanel"
          aria-labelledby={`service-tab-${activeCategory}`}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {isServerCategory
                  ? t("dashboard.servers.title", {
                      defaultValue: "Your servers",
                    })
                  : activeCategoryLabel}
              </h3>

              {isServerCategory && (
                <p className="mt-1 text-sm text-text-secondary">
                  {t("dashboard.servers.description", {
                    defaultValue: "Servers assigned to your account.",
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isServerCategory && (
                <button
                  type="button"
                  aria-pressed={previewMode}
                  onClick={() => setPreviewMode((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    previewMode
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border-subtle bg-surface text-text-secondary hover:bg-white/5 hover:text-text-primary"
                  }`}
                >
                  <Eye size={16} aria-hidden="true" />
                  {previewMode ? "Preview: ON" : "Preview: OFF"}
                </button>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching || isPreviewActive}
                className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={isFetching ? "animate-spin" : ""}
                />
                {t("dashboard.servers.refresh", {
                  defaultValue: "Refresh",
                })}
              </button>
            </div>
          </div>

          {isPreviewActive && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-text-secondary">
              <span className="font-semibold text-primary">
                Preview mode.
              </span>{" "}
              These servers are sample data and are not stored in the database.
            </div>
          )}

          {isPending ? (
            <div
              role="status"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <span className="sr-only">
                {isServerCategory
                  ? t("dashboard.servers.loading", {
                      defaultValue: "Loading servers...",
                    })
                  : t("dashboard.services.loading", {
                      defaultValue: "Loading services...",
                    })}
              </span>

              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  aria-hidden="true"
                  className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface"
                />
              ))}
            </div>
          ) : isError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-6"
            >
              <AlertCircle
                size={21}
                aria-hidden="true"
                className="shrink-0 text-red-400"
              />

              <div>
                <h3 className="font-semibold text-text-primary">
                  {isServerCategory
                    ? t("dashboard.servers.errorTitle", {
                        defaultValue: "Unable to load servers",
                      })
                    : t("dashboard.services.errorTitle", {
                        defaultValue: "Unable to load services",
                      })}
                </h3>

                <p className="mt-1 text-sm text-text-secondary">
                  {isServerCategory
                    ? t("dashboard.servers.errorDescription", {
                        defaultValue:
                          "The server list could not be loaded. Please try again.",
                      })
                    : t("dashboard.services.errorDescription", {
                        defaultValue:
                          "The service list could not be loaded. Please try again.",
                      })}
                </p>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-8 text-center sm:p-12">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ActiveCategoryIcon size={26} aria-hidden="true" />
              </div>

              <h3 className="mt-5 text-base font-semibold text-text-primary">
                {isServerCategory
                  ? t("dashboard.servers.emptyTitle", {
                      defaultValue: "No servers yet",
                    })
                  : activeCategoryLabel}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                {isServerCategory
                  ? t("dashboard.servers.emptyDescription", {
                      defaultValue:
                        "There are no servers assigned to your account.",
                    })
                  : t("dashboard.services.emptyDescription", {
                      defaultValue:
                        "No services are assigned to your account in this category.",
                    })}
              </p>
            </div>
          ) : isServerCategory ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedServers?.map(renderServerCard)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryServices.map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl border border-border-subtle bg-surface p-5"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ActiveCategoryIcon size={21} aria-hidden="true" />
                    </span>
                  </div>

                  <h4 className="break-words text-base font-semibold text-text-primary">
                    {service.name}
                  </h4>

                  <p className="mt-2 break-all text-xs text-text-secondary">
                    {t("dashboard.services.serviceId", {
                      defaultValue: "Service ID",
                    })}
                    : {service.id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
