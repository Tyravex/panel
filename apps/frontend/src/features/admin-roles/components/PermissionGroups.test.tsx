// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RBAC_V2_PERMISSIONS } from '@shared/types';
import en from '@/shared/i18n/locales/en/adminRoles.json';
import pl from '@/shared/i18n/locales/pl/adminRoles.json';
import { PermissionGroups } from './PermissionGroups';
import { groupRolePermissions, permissionTranslationKey } from '../lib/groupRolePermissions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { permission?: string }) => {
      const value = key.split('.').reduce<unknown>((current, part) =>
        (current as Record<string, unknown>)?.[part], en);
      return typeof value === 'string' ? value.replace('{{permission}}', values?.permission ?? '') : key;
    }
  }),
}));
afterEach(cleanup);

const records = [
  { id: 's1', name: 'service:read:any' }, { id: 'u1', name: 'user:read' },
  { id: 'custom', name: 'custom:permission' },
];
const Form = () => {
  const [selected, setSelected] = useState<string[]>(['custom']);
  return <><PermissionGroups permissions={records} selected={selected} setSelected={setSelected} />
    <output aria-label="Selected IDs">{selected.join(',')}</output></>;
};

describe('Modular role permissions', () => {
  it('keeps Services separate and preserves unknown permission selections', () => {
    render(<Form />);
    const services = screen.getByRole('group', { name: 'Services' });
    expect(within(services).getByText('service:read:any')).toBeTruthy();
    expect(within(services).queryByText('user:read')).toBeNull();
    expect(screen.getByRole('group', { name: 'Users' })).toBeTruthy();
    const other = screen.getByRole('group', { name: 'Other permissions' });
    expect((within(other).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(services).getByRole('checkbox'));
    expect(screen.getByLabelText('Selected IDs').textContent).toBe('custom,s1');
  });

  it('opens information on focus, associates its description, and closes on Escape', () => {
    render(<Form />);
    const info = screen.getByRole('button', { name: 'About permission: View all services' });
    fireEvent.focus(info);
    const tooltip = screen.getByRole('tooltip');
    expect(info.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.textContent).toContain('does not grant service management');
    fireEvent.keyDown(info, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('groups every catalog permission exactly once', () => {
    const input = RBAC_V2_PERMISSIONS.map((name) => ({ id: name, name }));
    const grouped = groupRolePermissions(input).flatMap((group) => group.permissions);
    expect(grouped).toHaveLength(input.length);
    expect(new Set(grouped.map((permission) => permission.id)).size).toBe(input.length);
  });

  it.each([['en', en], ['pl', pl]] as const)('provides labels and descriptions for every permission in %s', (_language, resource) => {
    for (const permission of RBAC_V2_PERMISSIONS) {
      const key = permissionTranslationKey(permission) as keyof typeof resource.adminRoles.permissionLabels;
      expect(resource.adminRoles.permissionLabels[key]).toBeTruthy();
      expect(resource.adminRoles.permissionDescriptions[key]).toBeTruthy();
    }
  });
});
