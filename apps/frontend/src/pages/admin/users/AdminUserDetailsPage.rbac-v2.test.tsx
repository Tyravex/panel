// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminUserDetailsPage } from './AdminUserDetailsPage';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  getAdminUser: vi.fn(),
}));

vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        id: 1,
        permissions: mocks.permissions,
      },
    }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '42' }),
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/admin-users/api/admin-users.api', () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock('@/features/admin-users/components/AdminUserServices', () => ({
  AdminUserServices: () => <div />,
}));

vi.mock('@/features/admin-users/components/AdminUsersBackLink', () => ({
  AdminUsersBackLink: () => <div />,
}));

vi.mock('@/shared/ui/SurfaceCard', () => ({
  SurfaceCard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

afterEach(() => cleanup());

describe('AdminUserDetailsPage RBAC v2', () => {
  beforeEach(() => {
    mocks.permissions = [];
    mocks.getAdminUser.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: 42,
      username: 'example',
      email: 'example@test.local',
      isActive: true,
      roles: [],
    });
  });

  it('shows the roles link with user:read and role:read', async () => {
    mocks.permissions = ['user:read', 'role:read'];

    render(<AdminUserDetailsPage />);

    const link = await screen.findByRole('link', {
      name: 'adminUsers.manageRoles',
    });

    expect(link.getAttribute('href')).toBe('/admin/users/42/roles');
  });

  it('hides the roles link when only role:manage is granted', async () => {
    mocks.permissions = ['user:read', 'role:manage'];

    render(<AdminUserDetailsPage />);

    await screen.findByRole('heading', { name: 'example' });

    expect(
      screen.queryByRole('link', { name: 'adminUsers.manageRoles' }),
    ).toBeNull();
  });

  it('hides the roles link without role:read', async () => {
    mocks.permissions = ['user:read'];

    render(<AdminUserDetailsPage />);

    await screen.findByRole('heading', { name: 'example' });

    expect(
      screen.queryByRole('link', { name: 'adminUsers.manageRoles' }),
    ).toBeNull();
  });

  it('hides the roles link without user:read', async () => {
    mocks.permissions = ['role:read'];

    render(<AdminUserDetailsPage />);

    await screen.findByRole('heading', { name: 'example' });

    expect(
      screen.queryByRole('link', { name: 'adminUsers.manageRoles' }),
    ).toBeNull();
  });

  it('shows the edit link with user:manage', async () => {
    mocks.permissions = ['user:read', 'user:manage'];

    render(<AdminUserDetailsPage />);

    const link = await screen.findByRole('link', {
      name: 'adminUsers.editUser',
    });

    expect(link.getAttribute('href')).toBe('/admin/users/42/edit');
  });

  it('hides the edit link without user:manage', async () => {
    mocks.permissions = ['user:read', 'role:read'];

    render(<AdminUserDetailsPage />);

    await screen.findByRole('heading', { name: 'example' });

    expect(
      screen.queryByRole('link', { name: 'adminUsers.editUser' }),
    ).toBeNull();
  });
});
