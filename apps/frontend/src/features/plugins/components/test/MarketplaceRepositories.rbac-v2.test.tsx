// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarketplaceRepositories } from '../MarketplaceRepositories';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/app/store/auth.store', () => ({
    useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: auth.permissions } }),
}));
vi.mock('../../hooks/useMarketplaceRepositories', () => ({
    useMarketplaceRepositories: () => ({
        repositories: [{ id: 'repo-1', name: 'Community', url: 'https://example.test', status: 'ENABLED', isOfficial: false }],
        loading: false, saving: false, error: null, refresh: vi.fn(),
        createRepository: vi.fn(), updateRepository: vi.fn(), deleteRepository: vi.fn(),
    }),
}));
afterEach(cleanup);

describe('Marketplace RBAC v2', () => {
    it('allows browsing without repository mutation controls', () => {
        auth.permissions = ['plugin:read', 'plugin:manage'];
        render(<MarketplaceRepositories />);
        expect(screen.getByRole('button', { name: 'View plugins' })).toBeTruthy();
        for (const name of ['Add repository', 'Rename', 'Disable', 'Delete']) {
            expect(screen.queryByRole('button', { name })).toBeNull();
        }
    });

    it('shows repository mutations with marketplace:manage', () => {
        auth.permissions = ['plugin:read', 'marketplace:manage'];
        render(<MarketplaceRepositories />);
        for (const name of ['Add repository', 'Rename', 'Disable', 'Delete']) {
            expect(screen.getByRole('button', { name })).toBeTruthy();
        }
    });
});
