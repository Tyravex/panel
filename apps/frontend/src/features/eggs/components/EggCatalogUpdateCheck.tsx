import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eggsApi } from '../api/eggsApi';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const EggCatalogUpdateCheck = ({ onChecked }: { onChecked: () => void }) => {
  const { t } = useTranslation(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const check = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const sources = (await eggsApi.repositories()).filter((source) => source.isOfficial && source.status === 'ENABLED');
      if (!sources.length) throw new Error(t('eggs.noOfficialRepository'));
      for (const source of sources) await eggsApi.checkOfficialUpdates(source.id);
      onChecked();
    } catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <div className="space-y-2"><button className="rounded-xl border border-border-subtle px-4 py-3 disabled:opacity-40" disabled={busy} onClick={() => void check()}>{t(busy ? 'common.loading' : 'eggs.checkUpdates')}</button>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</div>;
};
