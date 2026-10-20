import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { AuthInput } from '@/features/auth/components/AuthInput';
import { AuthSubmitButton } from '@/features/auth/components/AuthSubmitButton';
import { api } from '@/shared/api/client';

type LoginNavigationState = {
  logoutWarning?: boolean;
};

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  const logoutWarning =
    (location.state as LoginNavigationState | null)
      ?.logoutWarning === true;

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<{ enabled: boolean }>('/auth/registration-settings', {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setRegistrationEnabled(data.enabled === true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRegistrationEnabled(false);
        }
      });

    return () => controller.abort();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const authenticated = await login({
        usernameOrEmail,
        password,
      });

      if (authenticated) {
        navigate('/dashboard', {
          replace: true,
          state: null,
        });
      }
    } catch {
      setError(t('auth.login.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader
        title={t('auth.login.title')}
        description={t('auth.login.description')}
      />

      {logoutWarning && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
        >
          <AlertTriangle
            size={20}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />

          <div className="space-y-1">
            <p className="font-semibold">
              {t('auth.logout.warningTitle')}
            </p>

            <p>
              {t('auth.logout.warningDescription')}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <AuthInput
          id="login-identity"
          label={t('auth.login.identity')}
          type="text"
          placeholder={t('auth.login.identityPlaceholder')}
          autoComplete="username"
          required
          value={usernameOrEmail}
          onChange={(event) => setUsernameOrEmail(event.target.value)}
        />

        <AuthInput
          id="login-password"
          label={t('auth.login.password')}
          type="password"
          placeholder={t('auth.login.passwordPlaceholder')}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <AuthSubmitButton
          isSubmitting={isSubmitting}
          label={t('auth.login.submit')}
          submittingLabel={t('auth.login.submitting')}
        />
      </form>

      {registrationEnabled && (
        <div className="mt-6 border-t border-border-subtle pt-6 text-center text-sm text-text-secondary">
          {t('auth.login.noAccount')}{' '}

          <Link
            to="/register"
            className="font-semibold text-primary hover:underline"
          >
            {t('auth.login.registerLink')}
          </Link>
        </div>
      )}
    </AuthCard>
  );
};
