// @vitest-environment jsdom
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AdminUserFormValues } from '@shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { AdminUserEditPage } from './AdminUserEditPage';

const mocks = vi.hoisted(() => ({ update: vi.fn(), navigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate, useParams: () => ({ id: '42' }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/features/admin-users/components/AdminUsersBackLink', () => ({ AdminUsersBackLink: () => null }));
vi.mock('@/features/admin-users/api/admin-users.api', () => ({
  emptyAdminUserForm: () => ({ username: '', email: '', password: '', firstName: '', lastName: '' }),
  getAdminUser: () => Promise.resolve({ username: 'Example', email: 'a@example.test', firstName: null, lastName: null }),
  updateAdminUser: mocks.update,
}));
vi.mock('@/features/admin-users/components/AdminUserForm', () => ({
  AdminUserForm: ({ form, setForm, onSubmit }: {
    form: AdminUserFormValues;
    setForm: Dispatch<SetStateAction<AdminUserFormValues>>; onSubmit: (event: FormEvent<HTMLFormElement>) => void
  }) =>
    <form onSubmit={onSubmit}><input aria-label="Username" value={form.username}
      onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))} />
      <button>Save</button></form>,
}));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); mocks.update.mockResolvedValue(undefined); });
const warns = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('User edit draft protection', () => {
  it('uses loaded values as baseline, protects failures and bypasses only after successful save', async () => {
    renderWithUnsavedChanges(<AdminUserEditPage />);
    const input = await screen.findByRole('textbox');
    expect(warns()).toBe(false);
    fireEvent.change(input, { target: { value: 'Edited' } });
    expect(warns()).toBe(true);
    fireEvent.change(input, { target: { value: 'Example' } });
    expect(warns()).toBe(false);
    fireEvent.change(input, { target: { value: 'Edited' } });
    mocks.update.mockRejectedValueOnce(new Error('Save failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    expect(warns()).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/users'));
    expect(warns()).toBe(false);
  });
});
