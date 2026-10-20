import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Server, Users } from 'lucide-react';

import { TyravexLogo } from '@/features/auth/components/TyravexLogo';
import { AuthLanguageSwitcher } from '@/features/auth/components/AuthLanguageSwitcher';

export const AuthLayout = () => {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text-primary">
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Desktop language switcher */}
      <div className="absolute right-6 top-6 z-10 hidden lg:block">
        <AuthLanguageSwitcher />
      </div>

      <main className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-5 py-8 lg:grid-cols-2 lg:gap-20 lg:px-12">
        {/* Desktop branding */}
        <section className="hidden space-y-10 lg:block">
          <TyravexLogo />

          <div className="max-w-lg space-y-5">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t('auth.layout.title')}
            </h1>

            <p className="text-lg leading-relaxed text-text-secondary">
              {t('auth.layout.description')}
            </p>
          </div>

          <div className="grid max-w-lg gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Server size={18} className="shrink-0 text-primary" />
              <span>{t('auth.layout.servers')}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Users size={18} className="shrink-0 text-primary" />
              <span>{t('auth.layout.users')}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck size={18} className="shrink-0 text-primary" />
              <span>{t('auth.layout.security')}</span>
            </div>
          </div>
        </section>

        {/* Mobile / tablet form layout */}
        <section className="flex w-full flex-col items-center gap-6 lg:items-end">
          <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight text-text-primary">
                Tyravex
              </span>

              <span
                className="h-6 w-px bg-border-subtle"
                aria-hidden="true"
              />

              <span className="text-sm font-medium text-text-secondary">
                Panel
              </span>
            </div>

            <AuthLanguageSwitcher />
          </div>

          <Outlet />
        </section>
      </main>
    </div>
  );
};