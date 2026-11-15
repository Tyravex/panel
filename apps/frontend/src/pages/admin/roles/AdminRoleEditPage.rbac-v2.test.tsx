import { UnsavedChangesProvider } from '@/app/providers/UnsavedChangesProvider';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminRoleEditPage } from './AdminRoleEditPage';

const mocks = vi.hoisted(() => ({
  id: 'role-support', permissions: [] as string[],
  get: vi.fn(), patch: vi.fn(), navigate: vi.fn(), success: vi.fn(),
}));
vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('@/shared/api/client', () => ({ api: { get: mocks.get, patch: mocks.patch } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate, useParams: () => ({ id: mocks.id }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
    <a href={to} {...props}>{children}</a>,
}));

const support = {
  id: 'role-support', name: 'Support', permissions: [{ id: 'p-read', name: 'user:read' }], _count: { users: 2 },
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.id = 'role-support';
  mocks.permissions = ['role:read', 'role:manage'];
  mocks.get.mockImplementation((path: string) => Promise.resolve({
    data: path === '/admin/rbac/roles/role-support' ? support : [
      { id: 'p-read', name: 'user:read' }, { id: 'p-audit', name: 'audit:read' },
    ],
  }));
  mocks.patch.mockResolvedValue({ data: support });
});

describe('Role editing RBAC v2', () => {
  it.each([['role:read'], ['role:manage'], ['role:assign']])('requires read and manage (%s)', (permission) => {
    mocks.permissions = [permission];
    renderPage();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('loads the role, submits edited permissions, and returns to the list', async () => {
    renderPage();
    const input = await screen.findByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('Support');
    expect((screen.getByRole('checkbox', { name: /user:read/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(input, { target: { value: 'Support Team ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /audit:read/ }));
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.saveChanges' }));
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.review.confirm' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/admin/rbac/roles/role-support', {
      name: 'Support Team', permissionIds: ['p-read', 'p-audit'],
    }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/roles'));
    expect(mocks.success).toHaveBeenCalledWith('adminRoles.updated');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('does not allow editing Owner through a direct URL', async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve({ data:
      path === '/admin/rbac/roles/role-support' ? { ...support, name: 'Owner' } : [],
    }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'adminRoles.ownerProtected');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('handles a missing role without displaying a writable form', async () => {
    mocks.id = 'missing';
    mocks.get.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'adminRoles.roleNotFound');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('does not display a writable form after a loading error', async () => {
    mocks.get.mockRejectedValue(new Error('Load failed'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Load failed');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('preserves edits after the backend rejects a save', async () => {
    mocks.patch.mockRejectedValue({ response: { data: { message: 'Cannot grant global permissions to the default role' } } });
    renderPage();
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Edited Support' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.saveChanges' }));
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.review.confirm' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Cannot grant global permissions to the default role');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Edited Support');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('cancels without sending a PATCH request', async () => {
    renderPage();
    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/roles');
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('cancels review without discarding edits or sending a request', async () => {
    renderPage();
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Updated Support' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /user:read/ }));
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.saveChanges' }));
    const dialog = within(screen.getByRole('alertdialog'));
    expect(dialog.getByText('user:read')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'common.cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Updated Support');
    expect((screen.getByRole('checkbox', { name: /user:read/ }) as HTMLInputElement).checked).toBe(false);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('does not open review or save an unchanged role', async () => {
    renderPage();
    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.saveChanges' }));
    expect(screen.getByRole('status').textContent).toBe('adminRoles.review.noChanges');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

const renderPage = () => render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <UnsavedChangesProvider><AdminRoleEditPage /></UnsavedChangesProvider> }])} />);
