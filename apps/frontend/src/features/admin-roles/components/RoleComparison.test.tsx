// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AdminRole } from '../api/adminRolesApi';
import { RoleComparison } from './RoleComparison';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const read = { id: 'read', name: 'service:read:any' };
const create = { id: 'create', name: 'service:create' };
const user = { id: 'user', name: 'user:read' };
const custom = { id: 'custom', name: 'custom:read' };
const roles: AdminRole[] = [
  { id: 'a', name: 'Reader', permissions: [read, user], _count: { users: 0 } },
  { id: 'b', name: 'Operator', permissions: [read, create, user, custom], _count: { users: 0 } },
  { id: 'c', name: 'Observer', permissions: [read], _count: { users: 0 } },
  { id: 'd', name: 'Fourth', permissions: [], _count: { users: 0 } },
];
const select = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }));
const setup = () => render(<RoleComparison roles={roles} permissions={[read, create, user]} />);

describe('Role comparison', () => {
  it('requires two roles and limits the selection to three', () => {
    setup();
    select('Reader');
    expect(screen.queryByRole('table')).toBeNull();
    select('Operator');
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    select('Observer');
    expect((screen.getByRole('checkbox', { name: 'Fourth' }) as HTMLInputElement).disabled).toBe(true);
    select('Reader');
    expect((screen.getByRole('checkbox', { name: 'Fourth' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('shows shared grants, module differences, and uncatalogued permissions', () => {
    setup();
    select('Reader'); select('Operator');
    expect(screen.getByText('custom:read')).toBeTruthy();
    const row = screen.getByText('service:read:any').closest('tr')!;
    expect(within(row).getAllByText('adminRoles.compare.granted')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: 'adminRoles.compare.module' }), { target: { value: 'services' } });
    expect(screen.queryByText('custom:read')).toBeNull();
    expect(screen.queryByText('user:read')).toBeNull();
    select('adminRoles.compare.differencesOnly');
    expect(screen.queryByText('service:read:any')).toBeNull();
    const difference = screen.getByText('service:create').closest('tr')!;
    expect(within(difference).getByText('adminRoles.compare.granted')).toBeTruthy();
    expect(within(difference).getByText('adminRoles.compare.notGranted')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'users' } });
    expect(screen.getByRole('status').textContent).toBe('adminRoles.compare.noDifferences');
  });
});
