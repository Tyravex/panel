/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { AdminUsersTable } from '../AdminUsersTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

const createProps = (): ComponentProps<typeof AdminUsersTable> => ({
  search: '',
  setSearch: vi.fn(),
  status: 'all',
  onStatusFilter: vi.fn(),
  onSearch: vi.fn(),
  page: 1,
  setPage: vi.fn(),
  data: {
    items: [{
      id: 42,
      username: 'testuser',
      email: 'test@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      language: 'en',
      createdAt: '2026-01-01T00:00:00.000Z',
      roles: [],
      _count: { servers: 0, services: 0 },
    }],
    total: 1,
    page: 1,
    limit: 10,
    pages: 1,
  },
  loading: false,
  error: null,
  busy: false,
  canManage: false,
  currentUserId: 1,
  onView: vi.fn(),
  onSelectRoles: vi.fn(),
  onEdit: vi.fn(),
  canEditDetails: false,
  onChangeStatus: vi.fn(),
});

describe('RBAC v2 admin users table', () => {
  it('hides Roles when role:read is missing', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} canViewRoles={false} />);

    expect(
      screen.queryByRole('button', { name: 'adminUsers.roles' }),
    ).toBeNull();

    expect(screen.getByRole('button', { name: 'testuser' })).toBeTruthy();
  });

  it('allows navigation to Roles when both read permissions are present', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} canViewRoles={true} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'adminUsers.roles' }),
    );

    expect(props.onSelectRoles).toHaveBeenCalledWith(props.data?.items[0]);
  });

  it('does not expose editing or status mutations to read-only users', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} canViewRoles={true} />);

    expect(
      screen.queryByRole('button', { name: 'adminUsers.edit' }),
    ).toBeNull();

    expect(
      screen.queryByRole('button', { name: 'adminUsers.disable' }),
    ).toBeNull();
  });
});