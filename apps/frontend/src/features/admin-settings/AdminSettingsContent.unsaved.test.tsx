// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { AdminSettingsContent } from './AdminSettingsContent';

const mocks = vi.hoisted(() => ({ update: vi.fn(), translate: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock('./components/RegistrationSettingsCard', () => ({ RegistrationSettingsCard: () => null }));
vi.mock('./api/defaultRole.api', () => ({
  getDefaultRoleApi: () => Promise.resolve({ data: { id: 'guest', name: 'Guest' } }),
  getEligibleDefaultRolesApi: () => Promise.resolve({ data: [{ id: 'guest', name: 'Guest' }, { id: 'user', name: 'User' }] }),
  updateDefaultRoleApi: mocks.update,
}));
afterEach(cleanup);
beforeEach(() => { mocks.update.mockResolvedValue({ data: { id: 'user', name: 'User' } }); });
const warns = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
describe('Unsaved panel settings', () => {
  it('protects tab switching and returns to a clean baseline after saving', async () => {
    renderWithUnsavedChanges(<AdminSettingsContent />);
    const select = await screen.findByRole('combobox');
    expect(warns()).toBe(false);
    fireEvent.change(select, { target: { value: 'user' } });
    expect(warns()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'adminSettings.tabs.system' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.cancel' }));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('user');
    fireEvent.click(screen.getByRole('button', { name: 'adminSettings.defaultRoleSave' }));
    await waitFor(() => expect(warns()).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'adminSettings.tabs.system' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('adminSettings.comingSoon')).toBeTruthy();
  });
});
