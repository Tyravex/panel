// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import en from '@/shared/i18n/locales/en/adminRoles.json';
import type { AdminRole } from '../api/adminRolesApi';
import { AdminRolesTable } from './AdminRolesTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { role?: string; permission?: string }) => {
      const value = key.split('.').reduce<unknown>((current, part) => (current as Record<string, unknown>)?.[part], en);
      return typeof value === 'string' ? value.replace('{{role}}', values?.role ?? '').replace('{{permission}}', values?.permission ?? '') : key;
    }
  }),
}));
afterEach(cleanup);
const roles: AdminRole[] = [
  { id: 'owner', name: 'Owner', permissions: [], _count: { users: 1 } },
  { id: 'support', name: 'Support', permissions: [{ id: 'u', name: 'user:read' }], _count: { users: 3 } },
  { id: 'custom', name: 'Custom', permissions: [{ id: 'x', name: 'custom:access' }], _count: { users: 0 } },
];

const setup = (canManage = true, onDelete = vi.fn()) => {
  render(<MemoryRouter><AdminRolesTable roles={roles} total={roles.length} loading={false}
    canManage={canManage} saving={false} onDelete={onDelete} /></MemoryRouter>);
  return onDelete;
};

describe('Compact role list', () => {
  it('expands translated permission details and preserves unknown permissions', () => {
    setup(false);
    expect(screen.queryByText('user:read')).toBeNull();
    const button = screen.getByRole('button', { name: 'Show permissions for Support' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeTruthy();
    expect(screen.getByText('View users')).toBeTruthy();
    expect(screen.getByText('user:read')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'About permission: View users' }));
    expect(screen.getByRole('tooltip').textContent).toContain('administrative user lists');
    fireEvent.click(screen.getByRole('button', { name: 'Hide permissions for Support' }));
    expect(screen.queryByText('user:read')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show permissions for Custom' }));
    expect(screen.getByText('custom:access')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'common.edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.delete' })).toBeNull();
  });

  it('explains Owner and assigned role deletion restrictions and only deletes eligible roles', () => {
    const onDelete = setup();
    const owner = within(screen.getByText('Owner').closest('tr')!);
    expect(owner.getByText('Protected')).toBeTruthy();
    expect(owner.queryByRole('link')).toBeNull();
    expect((owner.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(owner.getByText('The Owner role is protected and cannot be edited or deleted.')).toBeTruthy();
    const support = within(screen.getByText('Support').closest('tr')!);
    expect(support.getByText('Unassign all users first')).toBeTruthy();
    const blocked = support.getByRole('button', { name: 'common.delete' });
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(blocked);
    expect(onDelete).not.toHaveBeenCalled();
    const custom = within(screen.getByText('Custom').closest('tr')!);
    fireEvent.click(custom.getByRole('button', { name: 'common.delete' }));
    expect(onDelete).toHaveBeenCalledWith(roles[2]);
  });

  it('distinguishes loading from an empty role list', () => {
    const { rerender } = render(<AdminRolesTable roles={[]} total={0} loading canManage={false} saving={false} onDelete={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Loading roles...');
    rerender(<AdminRolesTable roles={[]} total={0} loading={false} canManage={false} saving={false} onDelete={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('No roles have been created yet.');
  });
});
