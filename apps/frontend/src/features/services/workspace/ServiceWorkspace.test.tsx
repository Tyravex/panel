// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ServiceWorkspace } from './ServiceWorkspace';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../components/ServiceStatus', () => ({ ServiceStatus: () => null }));
vi.mock('../installation/components/ServiceInstallationCenter', () => ({
    ServiceInstallationCenter: ({ children }: { children: React.ReactNode }) => <div>Installation{children}</div>,
}));
afterEach(cleanup);

const renderWorkspace = (category: string, installStatus = 'INSTALLED') => render(
    <ServiceWorkspace service={{ id: 'service-1', name: 'Example', category: { key: category, name: category }, installStatus }}
        overview={<div>Existing installation actions</div>} />,
);

describe('Service workspace variants', () => {
    it.each([
        ['game_server', 'players', 'environment'],
        ['discord_bot', 'environment', 'players'],
        ['teamspeak', 'channels', 'players'],
        ['custom', 'console', 'players'],
    ])('shows modules appropriate for %s', (category, available, unavailable) => {
        renderWorkspace(category);
        expect(screen.getByRole('button', { name: `dashboard.workspace.tabs.${available}` })).toBeTruthy();
        expect(screen.queryByRole('button', { name: `dashboard.workspace.tabs.${unavailable}` })).toBeNull();
        expect(screen.getByText('Existing installation actions')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: `dashboard.workspace.tabs.${available}` }));
        expect(screen.getByText('dashboard.workspace.pendingTitle')).toBeTruthy();
    });

    it('preserves installation actions and hides workspace modules until installed', () => {
        renderWorkspace('discord_bot', 'PENDING');
        expect(screen.getByText('Existing installation actions')).toBeTruthy();
        expect(screen.queryByRole('navigation')).toBeNull();
    });
});
