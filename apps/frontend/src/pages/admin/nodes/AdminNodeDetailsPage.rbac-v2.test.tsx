import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { AdminNodeDetailsPage } from './AdminNodeDetailsPage';

const mocks = vi.hoisted(() => ({
    permissions: [] as string[], getNode: vi.fn(), update: vi.fn(), regions: vi.fn(), locations: vi.fn(),
}));
vi.mock('@/app/store/auth.store', () => ({
    useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...await importOriginal<typeof import('react-router-dom')>(),
    useNavigate: () => vi.fn(), useParams: () => ({ id: 'node-1' }),
    useSearchParams: () => [new URLSearchParams('tab=settings')],
}));
vi.mock('@/features/nodes/api/nodesApi', () => ({ nodesApi: { getById: mocks.getNode, update: mocks.update } }));
vi.mock('@/features/regions/api/regionsApi', () => ({ regionsApi: { list: mocks.regions } }));
vi.mock('@/features/locations/api/locationsApi', () => ({ locationsApi: { list: mocks.locations } }));
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = ['node:read'];
    mocks.getNode.mockResolvedValue({
        id: 'node-1', name: 'Example node', status: 'ONLINE', regionId: 'region-1', locationId: 'location-1',
        manualAllocationEnabled: true, automaticAllocationEnabled: false,
    });
    mocks.update.mockResolvedValue(undefined);
});

describe('Node details RBAC v2', () => {
    it('loads without region permissions and prevents saves for readers', async () => {
        renderWithUnsavedChanges(<AdminNodeDetailsPage />);
        const input = await screen.findByRole('textbox', { name: 'Node name' });
        expect((input.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
        expect(mocks.regions).not.toHaveBeenCalled();
        expect(mocks.locations).not.toHaveBeenCalled();
        fireEvent.submit(input.closest('form')!);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('updates permitted settings without overwriting inaccessible assignments', async () => {
        mocks.permissions = ['node:read', 'node:manage'];
        renderWithUnsavedChanges(<AdminNodeDetailsPage />);
        const input = await screen.findByRole('textbox', { name: 'Node name' });
        fireEvent.change(input, { target: { value: 'Renamed node' } });
        fireEvent.submit(input.closest('form')!);
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('node-1', {
            name: 'Renamed node', manualAllocationEnabled: true, automaticAllocationEnabled: false,
        }));
        expect(mocks.regions).not.toHaveBeenCalled();
        expect(mocks.locations).not.toHaveBeenCalled();
    });

    it('protects refresh and stops warning when changes are reverted', async () => {
        mocks.permissions = ['node:read', 'node:manage'];
        renderWithUnsavedChanges(<AdminNodeDetailsPage />);
        const input = await screen.findByRole('textbox', { name: 'Node name' });
        fireEvent.change(input, { target: { value: 'Unsaved node' } });
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(screen.getByRole('alertdialog')).toBeTruthy();
        expect(mocks.getNode).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'common.unsaved.discard' }));
        await waitFor(() => expect(mocks.getNode).toHaveBeenCalledTimes(2));
        await waitFor(() => expect((screen.getByRole('textbox', { name: 'Node name' }) as HTMLInputElement).value).toBe('Example node'));
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });
});
