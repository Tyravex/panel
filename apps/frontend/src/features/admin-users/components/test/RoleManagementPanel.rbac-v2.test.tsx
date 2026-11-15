/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RoleManagementPanel } from '../RoleManagementPanel';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  onChanged: vi.fn(),
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
    delete: mocks.delete,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const roles = [
  {
    id: 'role-moderator',
    name: 'Moderator',
    permissions: [{ id: 'perm-read', name: 'user:read' }],
    _count: { users: 1 },
  },
  {
    id: 'role-support',
    name: 'Support',
    permissions: [],
    _count: { users: 0 },
  },
];

const assignments = [
  {
    assignedAt: '2026-01-01T00:00:00.000Z',
    role: {
      id: 'role-moderator',
      name: 'Moderator',
      permissions: [{ id: 'perm-read', name: 'user:read' }],
    },
  },
];

const user = {
  id: 42,
  username: 'test-user',
  email: 'test@example.com',
};

const renderPanel = () =>
  render(
    <RoleManagementPanel
      user={user}
      onChanged={mocks.onChanged}
    />,
  );

beforeEach(() => {
  mocks.permissions = [];
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.delete.mockReset();
  mocks.onChanged.mockReset();

  mocks.get.mockImplementation((path: string) => {
    if (path === '/admin/rbac/roles') {
      return Promise.resolve({ data: roles });
    }

    if (path === '/admin/rbac/users/42/roles') {
      return Promise.resolve({ data: assignments });
    }

    return Promise.reject(new Error(`Unexpected GET: ${path}`));
  });
});

afterEach(() => {
  cleanup();
});

describe('RBAC v2 user role assignments', () => {
  it('allows role:read to view roles and existing assignments', async () => {
    mocks.permissions = ['role:read', 'user:read'];

    renderPanel();

    expect(await screen.findByText('Moderator')).toBeTruthy();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('adminUsers.assigned')).toBeTruthy();
    expect(screen.getByText('user:read')).toBeTruthy();
  });

  it('hides assignment mutations for role:read-only users', async () => {
    mocks.permissions = ['role:read', 'user:read'];

    renderPanel();

    await screen.findByText('Moderator');

    expect(
      screen.queryByRole('button', { name: 'adminUsers.assignRole' }),
    ).toBeNull();

    expect(
      screen.queryByRole('button', { name: 'adminUsers.removeRole' }),
    ).toBeNull();

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('shows assignment mutations when role:assign is granted', async () => {
    mocks.permissions = ['role:read', 'user:read', 'role:assign'];

    renderPanel();

    await screen.findByText('Moderator');

    expect(
      screen.getByRole('button', { name: 'adminUsers.assignRole' }),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', { name: 'adminUsers.removeRole' }),
    ).toBeTruthy();
  });

  it('does not treat role:manage as role:assign', async () => {
    mocks.permissions = ['role:read', 'user:read', 'role:manage'];

    renderPanel();

    await screen.findByText('Moderator');

    expect(
      screen.queryByRole('button', { name: 'adminUsers.assignRole' }),
    ).toBeNull();

    expect(
      screen.queryByRole('button', { name: 'adminUsers.removeRole' }),
    ).toBeNull();
  });
});