// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { AdminServicesPage } from './AdminServicesPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: { roles: ['Administrator'], permissions: ['service:read:any', 'service:create'] } }),
}));
vi.mock('@/features/services/api/adminServicesApi', () => ({ adminServicesApi: { list: () => Promise.resolve([]) } }));
afterEach(cleanup);

describe('Service list navigation', () => {
  it('links to a separate creation page without mounting an inline form or requiring Owner', async () => {
    renderWithUnsavedChanges(<AdminServicesPage />);
    await screen.findByText('adminServices.empty');
    expect(screen.getByRole('link', { name: 'adminServices.createService' }).getAttribute('href')).toBe('/admin/services/new');
    expect(screen.queryByRole('textbox', { name: 'adminServices.name' })).toBeNull();
  });
});