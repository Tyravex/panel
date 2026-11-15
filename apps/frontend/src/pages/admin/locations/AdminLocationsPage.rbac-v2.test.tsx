import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { AdminLocationsPage } from './AdminLocationsPage';

const mocks = vi.hoisted(() => ({ permissions: [] as string[], locations: vi.fn(), regions: vi.fn() }));
vi.mock('@/app/store/auth.store', () => ({
    useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
vi.mock('@/features/locations/api/locationsApi', () => ({ locationsApi: { list: mocks.locations } }));
vi.mock('@/features/regions/api/regionsApi', () => ({ regionsApi: { list: mocks.regions } }));
vi.mock('@/shared/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = ['location:manage'];
    mocks.locations.mockResolvedValue([{
        id: 'location-1', name: 'Warsaw', code: 'waw', regionId: 'region-1',
        continent: 'Europe', country: 'Poland', city: 'Warsaw', _count: { nodes: 0 },
    }]);
    mocks.regions.mockResolvedValue([]);
});

describe('Locations RBAC v2', () => {
    it('loads locations without requesting inaccessible regions and preserves the assigned region in edits', async () => {
        renderWithUnsavedChanges(<AdminLocationsPage />);
        await screen.findByText('waw');
        expect(mocks.regions).not.toHaveBeenCalled();
        expect((screen.getByRole('button', { name: 'Dodaj lokalizację' }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
        const region = screen.getByRole('button', { name: /Region/ });
        expect((region as HTMLButtonElement).disabled).toBe(true);
        expect(region.textContent).toContain('region-1');
    });
});
