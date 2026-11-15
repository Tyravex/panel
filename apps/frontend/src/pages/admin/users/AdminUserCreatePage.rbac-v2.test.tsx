import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { AdminUserCreatePage } from './AdminUserCreatePage';

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  createAdminUser: vi.fn(),
  navigate: vi.fn(),
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

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

vi.mock('@/features/admin-users/api/admin-users.api', () => ({
  createAdminUser: mocks.createAdminUser,
  emptyAdminUserForm: {
    username: '',
    email: '',
    password: '',
  },
}));

vi.mock('@/features/admin-users/components/AdminUserForm', () => ({
  AdminUserForm: () => <div data-testid="admin-user-create-form" />,
}));

vi.mock('@/features/admin-users/components/AdminUsersBackLink', () => ({
  AdminUsersBackLink: () => <div />,
}));

afterEach(() => cleanup());

describe('AdminUserCreatePage RBAC v2', () => {
  beforeEach(() => {
    mocks.permissions = [];
    mocks.createAdminUser.mockReset();
    mocks.navigate.mockReset();
  });

  it('shows the create form with user:create but without user:manage', () => {
    mocks.permissions = ['user:create'];

    renderWithUnsavedChanges(<AdminUserCreatePage />);

    expect(screen.getByTestId('admin-user-create-form')).toBeTruthy();
  });

  it('hides the create form with user:manage but without user:create', () => {
    mocks.permissions = ['user:manage'];

    renderWithUnsavedChanges(<AdminUserCreatePage />);

    expect(screen.queryByTestId('admin-user-create-form')).toBeNull();
  });

  it('hides the create form without either permission', () => {
    mocks.permissions = ['user:read'];

    renderWithUnsavedChanges(<AdminUserCreatePage />);

    expect(screen.queryByTestId('admin-user-create-form')).toBeNull();
  });
});