import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Bot, Boxes, Eye, RefreshCw, Send, Server, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { previewServers } from '@/features/servers/mock/servers.mock';
import type { UserService } from '@/features/services/api/services.api';
import { useServiceDashboardData } from '@/features/services/hooks/useServiceDashboardData';
import { useUser } from '@/shared/store/user';

type Category = 'server' | 'discord_bot' | 'telegram_bot' | 'other';
const statusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'online': return 'border-emerald-500/40 bg-emerald-950/90 text-emerald-400';
    case 'offline': return 'border-rose-500/40 bg-rose-950/90 text-rose-400';
    case 'maintenance': return 'border-amber-500/40 bg-amber-950/90 text-amber-400';
    default: return 'border-slate-500/40 bg-slate-950/90 text-slate-300';
  }
};

export const DashboardPage = () => {
  const user = useUser((state) => state.user);
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<Category>('server');
  const [previewMode, setPreviewMode] = useState(false);

  const { servicesQuery, serversQuery, services, standaloneServers, newServerServices, categoryCounts } = useServiceDashboardData(user?.id);
  const categoryServices = services.filter((service) => service.category?.key === activeCategory);
  const categories = [
    { id: 'server' as const, label: t('dashboard.categories.servers'), icon: Server, count: categoryCounts.server },
    { id: 'discord_bot' as const, label: t('dashboard.categories.discordBots'), icon: Bot, count: categoryCounts.discord_bot },
    { id: 'telegram_bot' as const, label: t('dashboard.categories.telegramBots'), icon: Send, count: categoryCounts.telegram_bot },
    { id: 'other' as const, label: t('dashboard.categories.other'), icon: Boxes, count: categoryCounts.other },
  ];
  const active = categories.find((item) => item.id === activeCategory)!;
  const isServer = activeCategory === 'server';
  const isPreview = isServer && previewMode;
  const pending = !isPreview && (servicesQuery.isPending || (isServer && serversQuery.isPending));
  const error = !isPreview && (servicesQuery.isError || (isServer && serversQuery.isError));
  const fetching = servicesQuery.isFetching || (isServer && serversQuery.isFetching);
  const empty = isServer ? (isPreview ? previewServers.length === 0 : standaloneServers.length + newServerServices.length === 0) : categoryServices.length === 0;

  const refresh = () => {
    void servicesQuery.refetch();
    if (isServer) void serversQuery.refetch();
  };

  const ActiveIcon = active.icon;

  const renderService = (service: UserService) => {
    const status = service.server?.status ?? service.installStatus ?? 'DRAFT';
    const linkedServerId = service.server?.id ?? service.serverId;
    const content = (
      <>
        <div className="relative flex aspect-[2.67/1] items-center justify-center bg-gradient-to-br from-primary/20 via-slate-900 to-slate-950">
          <ActiveIcon size={40} aria-hidden="true" className="text-primary/60" />
          <span className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>
            {status.toUpperCase() === 'DRAFT' ? t('dashboard.services.draft') : status}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <h4 className="truncate font-semibold text-text-primary">{service.name}</h4>
          <p className="break-all text-xs text-text-secondary">{t('dashboard.services.serviceId')}: {service.id}</p>
          {linkedServerId !== null && <p className="text-xs text-text-secondary">{t('dashboard.services.linkedServer')}: #{linkedServerId}</p>}
          {linkedServerId === null && <p className="text-xs text-text-secondary">{t('dashboard.services.detailsUnavailable')}</p>}
        </div>
      </>
    );
    return linkedServerId !== null ? (
      <Link key={`service-${service.id}`} to={`/servers/${linkedServerId}`} className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-primary/50">{content}</Link>
    ) : (
      <article key={`service-${service.id}`} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">{content}</article>
    );
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 sm:p-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"><ShieldCheck size={14} />Tyravex Panel</div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{t('dashboard.welcome', { username: user?.username || 'User' })}</h1>
        <p className="mt-3 text-sm text-text-secondary">{t('dashboard.services.description')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/profile" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"><UserRound size={17} />{t('sidebar.profile')}<ArrowRight size={15} /></Link>
          <Link to="/settings" className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium"><Settings2 size={17} />{t('sidebar.settings')}</Link>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="services-heading">
        <div>
          <h2 id="services-heading" className="text-lg font-semibold text-text-primary">{t('dashboard.services.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('dashboard.services.subtitle')}</p>
        </div>
        <div role="tablist" aria-label={t('dashboard.services.categoryLabel')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            const selected = activeCategory === category.id;
            return (
              <button key={category.id} id={`service-tab-${category.id}`} type="button" role="tab" aria-selected={selected} aria-controls="service-category-panel" onClick={() => setActiveCategory(category.id)} className={`flex min-h-28 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-primary/50 bg-primary/10 text-text-primary' : 'border-border-subtle bg-surface text-text-secondary hover:border-primary/30'}`}>
                <div className="flex w-full items-center justify-between gap-2"><Icon size={23} aria-hidden="true" /><span className="rounded-full border border-border-subtle px-2.5 py-0.5 text-xs font-semibold" aria-label={`${t('dashboard.services.count')}: ${category.count}`}>{servicesQuery.isPending || (category.id === 'server' && serversQuery.isPending) ? '…' : category.id === 'server' && serversQuery.isError ? '—' : category.count}</span></div>
                <span className="text-sm font-semibold">{category.label}</span>
              </button>
            );
          })}
        </div>

        <div id="service-category-panel" role="tabpanel" aria-labelledby={`service-tab-${activeCategory}`} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-text-primary">{isServer ? t('dashboard.servers.title') : active.label}</h3>{isServer && <p className="mt-1 text-sm text-text-secondary">{t('dashboard.servers.description')}</p>}</div>
            <div className="flex items-center gap-3">
              {isServer && <button type="button" aria-pressed={previewMode} onClick={() => setPreviewMode((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-3 py-2 text-sm"><Eye size={16} />{previewMode ? t('dashboard.services.previewOn') : t('dashboard.services.previewOff')}</button>}
              <button type="button" disabled={fetching || isPreview} onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />{t('dashboard.servers.refresh')}</button>
            </div>
          </div>
          {isPreview && <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-text-secondary">{t('dashboard.services.previewNote')}</p>}
          {pending ? <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><span className="sr-only">{t('dashboard.services.loading')}</span>{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />)}</div> : error ? (
            <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-red-300"><AlertCircle size={20} />{t('dashboard.services.errorTitle')} {t('dashboard.servers.retry')}</div>
          ) : empty ? <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center text-text-secondary">{isServer ? t('dashboard.servers.emptyDescription') : t('dashboard.services.emptyDescription')}</div> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {isServer ? (
                isPreview ? previewServers.map((server) => <article key={`preview-${server.id}`} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface"><div className="flex aspect-[2.67/1] items-center justify-center bg-slate-900">{server.image ? <img src={server.image} alt={server.game} className="h-full w-full object-cover" /> : <Server size={40} />}</div><div className="p-5"><h4 className="font-semibold">{server.name}</h4><p className="mt-2 text-xs text-text-secondary">{server.game}</p></div></article>) : <>
                  {standaloneServers.map((server) => <Link key={`legacy-${server.id}`} to={`/servers/${server.id}`} className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-primary/50"><div className="relative flex aspect-[2.67/1] items-center justify-center bg-gradient-to-br from-primary/20 via-slate-900 to-slate-950"><Server size={40} className="text-primary/60" /><span className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-xs ${statusClass(server.status ?? '')}`}>{server.status ?? t('dashboard.services.pendingInstallation')}</span></div><div className="p-5"><h4 className="font-semibold">{server.name}</h4><p className="mt-2 text-xs text-text-secondary">{t('dashboard.servers.serverId')}: {server.id}</p></div></Link>)}
                  {newServerServices.map(renderService)}
                </>
              ) : categoryServices.map(renderService)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
