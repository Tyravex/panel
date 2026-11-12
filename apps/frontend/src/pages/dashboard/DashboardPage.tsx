import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bot,
  Boxes,
  Layers,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { UserService } from '@/features/services/api/services.api';
import { ServiceFeedback } from '@/features/services/components/ServiceFeedback';
import { ServiceStatus } from '@/features/services/components/ServiceStatus';
import { useServiceDashboardData } from '@/features/services/hooks/useServiceDashboardData';
import { useUser } from '@/shared/store/user';

type Category = 'all' | 'server' | 'discord_bot' | 'telegram_bot' | 'other';

const categoryIcon = (key: string | undefined) => {
  switch (key) {
    case 'server': return Server;
    case 'discord_bot': return Bot;
    case 'telegram_bot': return Send;
    default: return Boxes;
  }
};

export const DashboardPage = () => {
  const user = useUser((state) => state.user);
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const { servicesQuery, services, categoryCounts } = useServiceDashboardData(user?.id);

  const categories = [
    { id: 'all' as const, label: t('dashboard.services.all', { defaultValue: 'All' }), icon: Layers, count: services.length },
    { id: 'server' as const, label: t('dashboard.categories.servers'), icon: Server, count: categoryCounts.server },
    { id: 'discord_bot' as const, label: t('dashboard.categories.discordBots'), icon: Bot, count: categoryCounts.discord_bot },
    { id: 'telegram_bot' as const, label: t('dashboard.categories.telegramBots'), icon: Send, count: categoryCounts.telegram_bot },
    { id: 'other' as const, label: t('dashboard.categories.other'), icon: Boxes, count: categoryCounts.other },
  ];

  const active = categories.find((item) => item.id === activeCategory)!;
  const pending = servicesQuery.isPending;
  const error = servicesQuery.isError;
  const fetching = servicesQuery.isFetching;

  const visibleServices = services.filter((service) =>
    activeCategory === 'all' ||
    (activeCategory === 'other'
      ? !['server', 'discord_bot', 'telegram_bot'].includes(service.category?.key ?? '')
      : service.category?.key === activeCategory),
  );

  const refresh = () => { void servicesQuery.refetch(); };

  const renderService = (service: UserService) => {
    const Icon = categoryIcon(service.category?.key);
    const categoryLabel = service.category?.name ?? t('dashboard.categories.other');

    return (
      <Link
        key={service.id}
        to={`/services/${service.id}`}
        className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-primary/50"
      >
        <div className="relative flex aspect-[2.67/1] items-center justify-center bg-gradient-to-br from-primary/20 via-slate-900 to-slate-950">
          <Icon size={40} aria-hidden="true" className="text-primary/60" />
          <div className="absolute left-3 top-3">
            <ServiceStatus kind="installation" status={service.installStatus} />
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 truncate font-semibold text-text-primary">{service.name}</h4>
            <span className="shrink-0 text-xs text-text-secondary">{categoryLabel}</span>
          </div>
          <p className="break-all text-xs text-text-secondary">
            {t('dashboard.services.serviceId')}: {service.id}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 sm:p-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <ShieldCheck size={14} aria-hidden="true" />
          Tyravex Panel
        </div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
          {t('dashboard.welcome', { username: user?.username || 'User' })}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">{t('dashboard.services.description')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/profile" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            <UserRound size={17} aria-hidden="true" />
            {t('sidebar.profile')}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/settings" className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium">
            <Settings2 size={17} aria-hidden="true" />
            {t('sidebar.settings')}
          </Link>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="services-heading">
        <div>
          <h2 id="services-heading" className="text-lg font-semibold text-text-primary">{t('dashboard.services.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('dashboard.services.subtitle')}</p>
        </div>
        <div role="tablist" aria-label={t('dashboard.services.categoryLabel')} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = category.icon;
            const selected = activeCategory === category.id;
            return (
              <button
                key={category.id}
                id={`service-tab-${category.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="service-category-panel"
                onClick={() => setActiveCategory(category.id)}
                className={`flex min-h-28 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${selected
                  ? 'border-primary/50 bg-primary/10 text-text-primary'
                  : 'border-border-subtle bg-surface text-text-secondary hover:border-primary/30'}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <Icon size={23} aria-hidden="true" />
                  <span className="rounded-full border border-border-subtle px-2.5 py-0.5 text-xs font-semibold" aria-label={`${t('dashboard.services.count')}: ${category.count}`}>
                    {pending ? '…' : error ? '—' : category.count}
                  </span>
                </div>
                <span className="text-sm font-semibold">{category.label}</span>
              </button>
            );
          })}
        </div>

        <div id="service-category-panel" role="tabpanel" aria-labelledby={`service-tab-${activeCategory}`} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text-primary">{activeCategory === 'server' ? t('dashboard.servers.title') : active.label}</h3>
              {activeCategory === 'server' && (
                <p className="mt-1 text-sm text-text-secondary">{t('dashboard.servers.description')}</p>
              )}
            </div>
            <button
              type="button"
              disabled={fetching}
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-3 py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" className={fetching ? 'animate-spin' : ''} />
              {t('dashboard.servers.refresh')}
            </button>
          </div>

          {pending ? (
            <ServiceFeedback kind="loading" loadingLabel={t('dashboard.services.loading')} />
          ) : error ? (
            <ServiceFeedback kind="error" title={t('dashboard.services.errorTitle')} retryLabel={t('dashboard.servers.retry')} onRetry={refresh} retrying={fetching} />
          ) : visibleServices.length === 0 ? (
            <ServiceFeedback kind="empty" description={activeCategory === 'server' ? t('dashboard.servers.emptyDescription') : t('dashboard.services.emptyDescription')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleServices.map(renderService)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
