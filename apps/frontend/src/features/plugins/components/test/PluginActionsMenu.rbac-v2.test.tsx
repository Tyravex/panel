// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PluginActionsMenu } from '../PluginActionsMenu';
import type { PluginRecord } from '../../api/pluginsApi';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/app/store/auth.store', () => ({
    useAuthStore: (select: (state: unknown) => unknown) =>
        select({ user: { permissions: auth.permissions } }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const openMenu = (...permissions: string[]) => {
    auth.permissions = permissions;
    render(<MemoryRouter><PluginActionsMenu
        plugin={{ id: 'example', status: 'INSTALLED' } as PluginRecord}
        onToggle={vi.fn()} onUninstall={vi.fn()}
    /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'adminPlugins.actions.open' }));
};

describe('Plugin actions RBAC v2', () => {
    it('keeps details available without mutation controls for readers', () => {
        openMenu('plugin:read');
        expect(screen.getByRole('menuitem', { name: 'adminPlugins.actions.details' })).toBeTruthy();
        expect(screen.queryByRole('menuitem', { name: 'adminPlugins.actions.disable' })).toBeNull();
        expect(screen.queryByRole('menuitem', { name: 'adminPlugins.actions.uninstall' })).toBeNull();
    });

    it('does not grant deletion through plugin:manage', () => {
        openMenu('plugin:read', 'plugin:manage');
        expect(screen.getByRole('menuitem', { name: 'adminPlugins.actions.disable' })).toBeTruthy();
        expect(screen.queryByRole('menuitem', { name: 'adminPlugins.actions.uninstall' })).toBeNull();
    });

    it('allows deletion independently from lifecycle management', () => {
        openMenu('plugin:read', 'plugin:delete');
        expect(screen.getByRole('menuitem', { name: 'adminPlugins.actions.uninstall' })).toBeTruthy();
        expect(screen.queryByRole('menuitem', { name: 'adminPlugins.actions.disable' })).toBeNull();
    });
});
