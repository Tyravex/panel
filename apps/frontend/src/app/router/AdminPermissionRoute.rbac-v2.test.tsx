/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPermissionRoute } from './AdminPermissionRoute';

const auth = vi.hoisted(() => ({
  user: null as null | { permissions: string[] },
}));

vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (selector: (state: {
    user: typeof auth.user;
  }) => unknown) => selector({ user: auth.user }),
}));

afterEach(() => {
  cleanup();
  auth.user = null;
});

const renderGuard = (permission: string | string[]) =>
  render(
    <MemoryRouter>
      <AdminPermissionRoute permission={permission}>
        <div>Protected content</div>
      </AdminPermissionRoute>
    </MemoryRouter>,
  );

describe('RBAC v2 route permission guard', () => {
  it('allows a matching single permission', () => {
    auth.user = { permissions: ['user:read'] };

    renderGuard('user:read');

    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it('rejects a missing single permission', () => {
    auth.user = { permissions: ['user:create'] };

    renderGuard('user:read');

    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('allows access when all required permissions exist', () => {
    auth.user = { permissions: ['user:read', 'role:read'] };

    renderGuard(['user:read', 'role:read']);

    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it('rejects access when only one of two permissions exists', () => {
    auth.user = { permissions: ['role:read'] };

    renderGuard(['user:read', 'role:read']);

    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('rejects access without an authenticated user', () => {
    renderGuard('role:read');

    expect(screen.queryByText('Protected content')).toBeNull();
  });
});