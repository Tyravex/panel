/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminRolesPage } from './AdminRolesPage';

const renderPage = () => render(<MemoryRouter><AdminRolesPage /></MemoryRouter>);

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (selector: (state: {
    user: { permissions: string[] };
  }) => unknown) =>
    selector({ user: { permissions: mocks.permissions } }),
}));

vi.mock('@/shared/api/client', () => ({
  api: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'adminRoles.permissionLabels.user_read' ? 'Podgląd użytkowników' : key,
  }),
}));

const moderator = {
  id: 'role-moderator',
  name: 'Moderator',
  permissions: [{ id: 'permission-read', name: 'user:read' }],
  _count: { users: 0 },
};

beforeEach(() => {
  mocks.permissions = [];
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.patch.mockReset();
  mocks.delete.mockReset();

  mocks.get.mockImplementation((path: string) => {
    if (path === '/admin/rbac/roles') {
      return Promise.resolve({ data: [moderator] });
    }
    if (path === '/admin/rbac/permissions') {
      return Promise.resolve({
        data: [{ id: 'permission-read', name: 'user:read' }],
      });
    }
    return Promise.reject(new Error(`Unexpected GET: ${path}`));
  });
});

afterEach(() => {
  cleanup();
});

describe('RBAC v2 role definition management', () => {
  it('allows role:read to view existing roles and permissions', async () => {
    mocks.permissions = ['role:read'];

    renderPage();

    expect(await screen.findByText('Moderator')).toBeTruthy();
    expect(screen.queryByText('user:read')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.list.showPermissions' }));
    expect((await screen.findAllByText('user:read')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'adminRoles.compare.title' }).getAttribute('href')).toBe('/admin/roles/compare');
    expect(screen.queryByText('adminRoles.permissionMatrix')).toBeNull();
    expect(mocks.get).not.toHaveBeenCalledWith('/admin/rbac/permissions', expect.anything());
  });

  it('hides role creation and mutation buttons from role:read-only users', async () => {
    mocks.permissions = ['role:read'];

    renderPage();

    await screen.findByText('Moderator');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'adminRoles.createRole' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'adminRoles.createRole' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'common.edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'common.delete' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'adminRoles.roleName' })).toBeNull();
    });

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('shows mutation controls with role:manage', async () => {
    mocks.permissions = ['role:read', 'role:manage'];

    renderPage();

    await screen.findByText('Moderator');

    expect(screen.getByRole('link', { name: 'adminRoles.createRole' }).getAttribute('href')).toBe('/admin/roles/new');
    expect(screen.queryByRole('textbox', { name: 'adminRoles.roleName' })).toBeNull();
    expect(screen.getByRole('link', { name: 'common.edit' }).getAttribute('href')).toBe('/admin/roles/role-moderator/edit');
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeTruthy();
  });

  it('combines module filtering with searches by name, code and translated permission label', async () => {
    mocks.permissions = ['role:read'];
    mocks.get.mockResolvedValue({
      data: [moderator, {
        id: 'game-operator', name: 'Game Operator',
        permissions: [{ id: 'service-read', name: 'service:read:any' }], _count: { users: 0 },
      }]
    });
    renderPage();
    await screen.findByText('Moderator');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: '  GAME  ' } });
    expect(screen.getByText('Game Operator')).toBeTruthy();
    expect(screen.queryByText('Moderator')).toBeNull();
    fireEvent.change(search, { target: { value: 'user:read' } });
    expect(screen.getByText('Moderator')).toBeTruthy();
    expect(screen.queryByText('Game Operator')).toBeNull();
    fireEvent.change(search, { target: { value: 'podgląd użytkowników' } });
    expect(screen.getByText('Moderator')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'services' } });
    expect(screen.queryByText('Moderator')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('adminRoles.list.noMatches');
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.list.clearFilters' }));
    expect(screen.getByText('Moderator')).toBeTruthy();
    expect(screen.getByText('Game Operator')).toBeTruthy();
  });

});
