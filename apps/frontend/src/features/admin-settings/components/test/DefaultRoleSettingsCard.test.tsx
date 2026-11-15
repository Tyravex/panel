/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getDefaultRoleApi: vi.fn(),
    getEligibleDefaultRolesApi: vi.fn(),
    updateDefaultRoleApi: vi.fn(),
    translate: (key: string) => key,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: mocks.translate,
    }),
}));

vi.mock('../../api/defaultRole.api', () => ({
    getDefaultRoleApi: mocks.getDefaultRoleApi,
    getEligibleDefaultRolesApi: mocks.getEligibleDefaultRolesApi,
    updateDefaultRoleApi: mocks.updateDefaultRoleApi,
}));

import { DefaultRoleSettingsCard } from '../DefaultRoleSettingsCard';

const userRole = { id: 'role-user', name: 'User' };
const guestRole = { id: 'role-guest', name: 'Guest' };

const saveButton = () =>
    screen.getByRole('button', {
        name: 'adminSettings.defaultRoleSave',
    }) as HTMLButtonElement;

const roleSelect = () =>
    screen.getByRole('combobox', {
        name: 'adminSettings.defaultRoleSelect',
    }) as HTMLSelectElement;

const currentRoleText = () =>
    screen.getByText('adminSettings.defaultRoleCurrent').textContent;

beforeEach(() => {
    vi.resetAllMocks();

    mocks.getDefaultRoleApi.mockResolvedValue({
        data: userRole,
    });

    mocks.getEligibleDefaultRolesApi.mockResolvedValue({
        data: [userRole, guestRole],
    });

    mocks.updateDefaultRoleApi.mockResolvedValue({
        data: guestRole,
    });
});

afterEach(() => {
    cleanup();
});

describe('DefaultRoleSettingsCard', () => {
    it('loads the current role and prevents saving without a change', async () => {
        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(roleSelect().value).toBe(userRole.id);
        });

        expect(currentRoleText()).toContain(userRole.name);
        expect(saveButton().disabled).toBe(true);

        expect(mocks.getDefaultRoleApi).toHaveBeenCalledTimes(1);
        expect(mocks.getEligibleDefaultRolesApi).toHaveBeenCalledTimes(1);
        expect(mocks.updateDefaultRoleApi).not.toHaveBeenCalled();
    });

    it('saves the selected role ID and updates the displayed role', async () => {
        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(roleSelect().value).toBe(userRole.id);
        });

        fireEvent.change(roleSelect(), {
            target: { value: guestRole.id },
        });

        expect(saveButton().disabled).toBe(false);

        fireEvent.click(saveButton());

        await waitFor(() => {
            expect(mocks.updateDefaultRoleApi).toHaveBeenCalledExactlyOnceWith(
                guestRole.id,
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toContain(
                'adminSettings.defaultRoleSaveSuccess',
            );
            expect(currentRoleText()).toContain(guestRole.name);
            expect(roleSelect().value).toBe(guestRole.id);
            expect(saveButton().disabled).toBe(true);
        });
    });

    it('preserves the current role when saving fails', async () => {
        mocks.updateDefaultRoleApi.mockRejectedValue(
            new Error('Role is no longer eligible'),
        );

        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(roleSelect().value).toBe(userRole.id);
        });

        fireEvent.change(roleSelect(), {
            target: { value: guestRole.id },
        });

        fireEvent.click(saveButton());

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'adminSettings.defaultRoleSaveError',
            );
        });

        expect(currentRoleText()).toContain(userRole.name);
        expect(roleSelect().value).toBe(guestRole.id);
        expect(mocks.updateDefaultRoleApi).toHaveBeenCalledTimes(1);
    });

    it('blocks editing when loading the default role fails', async () => {
        mocks.getDefaultRoleApi.mockRejectedValue(
            new Error('Service unavailable'),
        );

        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'adminSettings.defaultRoleLoadError',
            );
        });

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(mocks.updateDefaultRoleApi).not.toHaveBeenCalled();
    });

    it('disables saving when no eligible roles are returned', async () => {
        mocks.getEligibleDefaultRolesApi.mockResolvedValue({
            data: [],
        });

        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(screen.getByText(
                'adminSettings.defaultRoleNoEligible',
            )).toBeTruthy();
        });

        expect(roleSelect().disabled).toBe(true);
        expect(saveButton().disabled).toBe(true);
        expect(mocks.updateDefaultRoleApi).not.toHaveBeenCalled();
    });

    it('does not offer roles absent from the eligible response', async () => {
        mocks.getEligibleDefaultRolesApi.mockResolvedValue({
            data: [userRole],
        });

        render(<DefaultRoleSettingsCard />);

        await waitFor(() => {
            expect(roleSelect().value).toBe(userRole.id);
        });

        const options = Array.from(roleSelect().options).map(
            (option) => option.value,
        );

        expect(options).toEqual([userRole.id]);
        expect(options).not.toContain(guestRole.id);
        expect(saveButton().disabled).toBe(true);
    });
});
