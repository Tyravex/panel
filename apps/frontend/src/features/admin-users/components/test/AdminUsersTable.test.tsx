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

describe('AdminUsersTable navigation', () => {
  const createProps = (): ComponentProps<typeof AdminUsersTable> => ({
    search: '',
    setSearch: vi.fn(),
    status: '',
    onStatusFilter: vi.fn(),
    onSearch: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    data: {
      items: [
        {
          id: 42,
          username: 'testuser',
          email: 'test@example.com',
          firstName: null,
          lastName: null,
          isActive: true,
          language: 'en',
          createdAt: '2026-01-01T00:00:00.000Z',
          roles: [],
          _count: {
            servers: 0,
            services: 0,
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
    },
    loading: false,
    error: null,
    busy: false,
    canManage: true,
    canViewRoles: true,
    currentUserId: 1,
    onView: vi.fn(),
    onSelectRoles: vi.fn(),
    onEdit: vi.fn(),
    canEditDetails: true,
    onChangeStatus: vi.fn(),
  });

  it('opens user details when clicking the username', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'testuser' }));

    expect(props.onView).toHaveBeenCalledWith(props.data?.items[0]);
    expect(props.onSelectRoles).not.toHaveBeenCalled();
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('opens role management when clicking Roles', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'adminUsers.roles' }),
    );

    expect(props.onSelectRoles).toHaveBeenCalledWith(props.data?.items[0]);
    expect(props.onView).not.toHaveBeenCalled();
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('opens user editing when clicking Edit', () => {
    const props = createProps();

    render(<AdminUsersTable {...props} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'adminUsers.edit' }),
    );

    expect(props.onEdit).toHaveBeenCalledWith(props.data?.items[0]);
    expect(props.onView).not.toHaveBeenCalled();
    expect(props.onSelectRoles).not.toHaveBeenCalled();
  });
});