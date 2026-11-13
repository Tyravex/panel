import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/shared/api/client';
import { getAdminUserServices } from '../admin-users.api';

const mockedGet = vi.mocked(api.get);

describe('getAdminUserServices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requests services for the selected user', async () => {
    const services = [
      { id: 'service-1', name: 'Minecraft', access: 'Owner' },
      { id: 'service-2', name: 'Bot', access: 'Member' },
    ];

    mockedGet.mockResolvedValueOnce({ data: services });

    const result = await getAdminUserServices(42);

    expect(mockedGet).toHaveBeenCalledExactlyOnceWith(
      '/admin/users/42/services',
      { signal: undefined },
    );

    expect(result).toEqual(services);
  });

  it('passes AbortSignal to the API client', async () => {
    const controller = new AbortController();

    mockedGet.mockResolvedValueOnce({ data: [] });

    await getAdminUserServices(7, controller.signal);

    expect(mockedGet).toHaveBeenCalledExactlyOnceWith(
      '/admin/users/7/services',
      { signal: controller.signal },
    );
  });

  it('returns an empty list when the API returns no services', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });

    await expect(getAdminUserServices(3)).resolves.toEqual([]);
  });

  it('propagates HTTP errors', async () => {
    const error = new Error('Request failed with status code 403');

    mockedGet.mockRejectedValueOnce(error);

    await expect(getAdminUserServices(42)).rejects.toBe(error);
  });
});
