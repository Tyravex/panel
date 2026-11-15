import { UnsavedChangesProvider } from '@/app/providers/UnsavedChangesProvider';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminRoleCreatePage } from './AdminRoleCreatePage';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[], get: vi.fn(), post: vi.fn(), navigate: vi.fn(), success: vi.fn(),
}));
vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('@/shared/api/client', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; className?: string }) =>
    <a href={to} {...props}>{children}</a>,
}));

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.permissions = ['role:read', 'role:manage'];
  mocks.get.mockResolvedValue({ data: [{ id: 'p-read', name: 'user:read' }] });
  mocks.post.mockResolvedValue({ data: { id: 'new-role', name: 'Support', permissions: [] } });
});

describe('Role creation RBAC v2', () => {
  it.each([[], ['role:read'], ['role:manage'], ['role:assign']])(
    'requires both read and manage permissions (%j)', async (...permissions: string[]) => {
      mocks.permissions = permissions;
      renderPage();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it('creates through the existing endpoint and returns to the list', async () => {
    renderPage();
    await screen.findByRole('checkbox', { name: /user:read/ });
    fireEvent.change(screen.getByRole('textbox', { name: 'adminRoles.roleName' }), { target: { value: 'Support ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /user:read/ }));
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.createRole' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/rbac/roles', {
      name: 'Support', permissionIds: ['p-read'],
    }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/roles'));
    expect(mocks.success).toHaveBeenCalledWith('adminRoles.created');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    expect(mocks.get).toHaveBeenCalledWith('/admin/rbac/permissions', { signal: expect.any(AbortSignal) });
  });

  it('preserves the form and displays backend validation errors', async () => {
    mocks.post.mockRejectedValue({ response: { data: { message: 'Role name already exists' } } });
    renderPage();
    await screen.findByRole('checkbox', { name: /user:read/ });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Support' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.createRole' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Role name already exists');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Support');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('blocks saving after the permission catalog fails to load', async () => {
    mocks.get.mockRejectedValue(new Error('Catalog unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Catalog unavailable');
    const input = screen.getByRole('textbox');
    expect((input.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.submit(input.closest('form')!);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cancels without creating a role', async () => {
    renderPage();
    await screen.findByRole('checkbox', { name: /user:read/ });
    expect(screen.getByRole('link', { name: 'adminRoles.backToRoles' }).getAttribute('href')).toBe('/admin/roles');
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/roles');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

const renderPage = () => render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <UnsavedChangesProvider><AdminRoleCreatePage /></UnsavedChangesProvider> }])} />);
