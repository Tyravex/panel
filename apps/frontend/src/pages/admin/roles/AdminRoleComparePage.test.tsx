// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminRoleComparePage } from './AdminRoleComparePage';

const mocks = vi.hoisted(() => ({ permissions: [] as string[], get: vi.fn() }));
vi.mock('@/app/store/auth.store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: mocks.permissions } }),
}));
vi.mock('@/shared/api/client', () => ({ api: { get: mocks.get } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const setup = () => render(<MemoryRouter initialEntries={['/admin/roles/compare']}><AdminRoleComparePage /></MemoryRouter>);
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.permissions = ['role:read'];
  mocks.get.mockImplementation((path: string) => Promise.resolve({
    data: path === '/admin/rbac/roles'
      ? [{ id: 'r1', name: 'Reader', permissions: [], _count: { users: 0 } }] : []
  }));
});

describe('Comparison page access', () => {
  it('loads for role:read without management and marks the comparison link active', async () => {
    setup();
    expect(await screen.findByRole('checkbox', { name: 'Reader' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'adminRoles.compare.title' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'adminRoles.rolesTab' }).getAttribute('href')).toBe('/admin/roles');
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('does not fetch comparison data without role:read', () => {
    mocks.permissions = ['role:manage'];
    setup();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('allows retrying a failed load', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Load failed'));
    setup();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Load failed');
    fireEvent.click(screen.getByRole('button', { name: 'adminRoles.compare.retry' }));
    expect(await screen.findByRole('checkbox', { name: 'Reader' })).toBeTruthy();
  });
});
