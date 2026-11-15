import { api } from '@/shared/api/client';
import type { OfficialEggSettings } from '@shared/types';

export const eggUpdateSettingsApi = {
  async get(signal?: AbortSignal): Promise<OfficialEggSettings> { return (await api.get<OfficialEggSettings>('/admin/egg-settings', { signal })).data; },
  async update(enabled: boolean): Promise<OfficialEggSettings> { return (await api.patch<OfficialEggSettings>('/admin/egg-settings', { enabled })).data; },
  async check(id: string) { return (await api.post(`/admin/egg-settings/${encodeURIComponent(id)}/check`)).data; },
};
