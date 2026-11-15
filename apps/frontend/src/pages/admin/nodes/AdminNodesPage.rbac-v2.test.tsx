// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdminNodesPage } from './AdminNodesPage';

const mocks = vi.hoisted(() => ({
    permissions: [] as string[],
    nodes: vi.fn(), regions: vi.fn(), locations: vi.fn(),
    deleteNode: vi.fn(), rotateToken: vi.fn(),
}));
vi.mock('@/app/store/auth.store', () => ({
    useAuthStore: (select: (state: unknown) => unknown) =>
        select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/features/nodes/api/nodesApi', () => ({
    nodesApi: { list: mocks.nodes, delete: mocks.deleteNode, rotateToken: mocks.rotateToken },
}));
vi.mock('@/features/regions/api/regionsApi', () => ({ regionsApi: { list: mocks.regions } }));
vi.mock('@/features/locations/api/locationsApi', () => ({ locationsApi: { list: mocks.locations } }));
vi.mock('@/features/nodes/components/NodeTokenDialog', () => ({ NodeTokenDialog: () => null }));

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = ['node:read'];
    mocks.nodes.mockResolvedValue([{
        id: 'node-1', name: 'Example node', status: 'ONLINE',
        regionId: 'region-1', locationId: 'location-1',
        lastSeenAt: null, createdAt: '2026-01-01T00:00:00Z',
    }]);
    mocks.regions.mockResolvedValue([]);
    mocks.locations.mockResolvedValue([]);
});

describe('Nodes RBAC v2', () => {
    it('loads nodes without requesting inaccessible region or location data', async () => {
        render(<AdminNodesPage />);
        await screen.findByRole('button', { name: 'Example node' });
        expect(mocks.nodes).toHaveBeenCalled();
        expect(mocks.regions).not.toHaveBeenCalled();
        expect(mocks.locations).not.toHaveBeenCalled();
        for (const name of ['Edit', 'adminNodes.rotate', 'adminNodes.delete', 'adminNodes.listPage_newNode']) {
            expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
        }
        fireEvent.click(screen.getByRole('button', { name: 'adminNodes.delete' }));
        expect(mocks.deleteNode).not.toHaveBeenCalled();
    });

    it('allows deletion independently from node management', async () => {
        mocks.permissions = ['node:read', 'node:delete'];
        render(<AdminNodesPage />);
        await screen.findByRole('button', { name: 'Example node' });
        expect((screen.getByRole('button', { name: 'adminNodes.delete' }) as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole('button', { name: 'adminNodes.rotate' }) as HTMLButtonElement).disabled).toBe(true);
    });
});
