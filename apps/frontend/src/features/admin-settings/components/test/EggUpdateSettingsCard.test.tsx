// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EggUpdateSettingsCard } from '../EggUpdateSettingsCard';

const mocks = vi.hoisted(() => ({ permissions: [] as string[], get: vi.fn(), update: vi.fn(), translate: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock('@/app/store/auth.store', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }) }));
vi.mock('../../api/eggUpdateSettings.api', () => ({ eggUpdateSettingsApi: { get: mocks.get, update: mocks.update } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.permissions = ['settings:manage', 'egg-repository:sync', 'egg:import']; mocks.get.mockResolvedValue({ enabled: false, intervalHours: 1, repositories: [] }); mocks.update.mockResolvedValue({ enabled: true, intervalHours: 1, repositories: [] }); });
describe('Official Egg automatic updates settings', () => {
  it('defaults to the stored disabled state and saves an explicit change', async () => {
    const dirty = vi.fn(); render(<EggUpdateSettingsCard onDirtyChange={dirty} />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    await waitFor(() => expect(checkbox.disabled).toBe(false)); expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox); expect(dirty).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(true));
    await screen.findByRole('status');
  });
  it('disables the toggle when import permission is missing', async () => {
    mocks.permissions = ['settings:manage', 'egg-repository:sync']; render(<EggUpdateSettingsCard />);
    await screen.findByText('eggs.noOfficialRepository');
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
