import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { registerApi } from '@/features/auth/api/auth.api';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { AuthInput } from '@/features/auth/components/AuthInput';
import { AuthSubmitButton } from '@/features/auth/components/AuthSubmitButton';
import { api } from '@/shared/api/client';

type RegistrationSettings = {
  enabled: boolean;
};

export const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<RegistrationSettings>('/auth/registration-settings', {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setRegistrationEnabled(data.enabled === true);
          setSettingsError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRegistrationEnabled(false);
          setSettingsError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSettingsLoading(false);
        }
      });

    return () => controller.abort();
  }, [t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      isSubmitting ||
      settingsLoading ||
      settingsError ||
      !registrationEnabled
    ) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await registerApi({
        username,
        email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      navigate('/login', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setRegistrationEnabled(false);
        setError('');
      } else {
        setError(t('auth.register.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader
        title={t('auth.register.title')}
        description={t('auth.register.description')}
      />

      {settingsLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t('auth.register.settingsLoading')}
        </p>
      ) : settingsError ? (
        <p role="alert" className="text-sm text-red-400">
          {t('auth.register.settingsError')}
        </p>
      ) : !registrationEnabled ? (
        <p role="status" className="text-sm text-text-secondary">
          {t('auth.register.disabled')}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <AuthInput
            id="register-username"
            label={t('auth.register.username')}
            type="text"
            autoComplete="username"
            placeholder={t('auth.register.usernamePlaceholder')}
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <AuthInput
            id="register-email"
            label={t('auth.register.email')}
            type="email"
            autoComplete="email"
            placeholder={t('auth.register.emailPlaceholder')}
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              id="register-first-name"
              label={`${t('auth.register.firstName')} (${t('common.optional')})`}
              type="text"
              autoComplete="given-name"
              placeholder={t('auth.register.firstName')}
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />

            <AuthInput
              id="register-last-name"
              label={`${t('auth.register.lastName')} (${t('common.optional')})`}
              type="text"
              autoComplete="family-name"
              placeholder={t('auth.register.lastName')}
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>

          <AuthInput
            id="register-password"
            label={t('auth.register.password')}
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={t('auth.register.passwordHint')}
          />

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <AuthSubmitButton
            isSubmitting={isSubmitting}
            label={t('auth.register.submit')}
            submittingLabel={t('auth.register.submitting')}
          />
        </form>
      )}

      <div className="mt-6 border-t border-border-subtle pt-6 text-center text-sm text-text-secondary">
        {t('auth.register.hasAccount')}{' '}

        <Link
          to="/login"
          className="font-semibold text-primary hover:underline"
        >
          {t('auth.register.loginLink')}
        </Link>
      </div>
    </AuthCard>
  );
};
