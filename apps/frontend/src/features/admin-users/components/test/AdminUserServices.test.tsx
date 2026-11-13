/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';

vi.mock('@/features/admin-users/api/admin-users.api', () => ({
  getAdminUserServices: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/ui/SurfaceCard', () => ({
  SurfaceCard: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { getAdminUserServices } from '@/features/admin-users/api/admin-users.api';
import { AdminUserServices } from '../AdminUserServices';

const mockedGetServices = vi.mocked(getAdminUserServices);

type Services = Awaited<ReturnType<typeof getAdminUserServices>>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('AdminUserServices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderServices = (
    props: ComponentProps<typeof AdminUserServices> = { userId: 42 },
  ) => render(<AdminUserServices {...props} />);

  it('renders services with Owner and Member labels', async () => {
    const services: Services = [
      { id: 'service-owner', name: 'Minecraft', access: 'Owner' },
      { id: 'service-member', name: 'Discord Bot', access: 'Member' },
    ];

    mockedGetServices.mockResolvedValueOnce(services);

    renderServices();

    expect(await screen.findByText('Minecraft')).toBeTruthy();
    expect(screen.getByText('Discord Bot')).toBeTruthy();
    expect(screen.getByText('service-owner')).toBeTruthy();
    expect(screen.getByText('service-member')).toBeTruthy();
    expect(screen.getByText('adminUsers.serviceOwner')).toBeTruthy();
    expect(screen.getByText('adminUsers.serviceMember')).toBeTruthy();
    expect(mockedGetServices).toHaveBeenCalledWith(
      42,
      expect.any(AbortSignal),
    );
  });

  it('renders the empty state', async () => {
    mockedGetServices.mockResolvedValueOnce([]);

    renderServices();

    expect(
      await screen.findByText('adminUsers.noServices'),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows loading while the request is pending', () => {
    const request = deferred<Services>();
    mockedGetServices.mockReturnValueOnce(request.promise);

    renderServices();

    expect(screen.getByRole('status').textContent).toContain(
      'adminUsers.servicesLoading',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders an error when the request fails', async () => {
    mockedGetServices.mockRejectedValueOnce(new Error('API unavailable'));

    renderServices();

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'adminUsers.servicesLoadError',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('aborts the previous request when userId changes', async () => {
    const first = deferred<Services>();
    const second = deferred<Services>();

    mockedGetServices
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const view = renderServices({ userId: 42 });

    const firstSignal = mockedGetServices.mock.calls[0]?.[1];
    expect(firstSignal?.aborted).toBe(false);

    view.rerender(<AdminUserServices userId={43} />);

    expect(firstSignal?.aborted).toBe(true);
    expect(mockedGetServices).toHaveBeenCalledWith(
      43,
      expect.any(AbortSignal),
    );

    first.resolve([
      { id: 'old-service', name: 'Old Service', access: 'Owner' },
    ]);

    second.resolve([
      { id: 'new-service', name: 'New Service', access: 'Member' },
    ]);

    expect(await screen.findByText('New Service')).toBeTruthy();
    expect(screen.queryByText('Old Service')).toBeNull();

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
