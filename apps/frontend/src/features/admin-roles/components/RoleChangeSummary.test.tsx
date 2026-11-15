// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import en from '@/shared/i18n/locales/en/adminRoles.json';
import { RoleChangeSummary } from './RoleChangeSummary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      const value = key.split('.').reduce<unknown>((current, part) => (current as Record<string, unknown>)?.[part], en);
      return typeof value === 'string' ? value.replace('{{count}}', String(values?.count ?? '')) : key;
    },
  })
}));
afterEach(cleanup);

describe('Role change summary', () => {
  it('shows assignment count, rename and the exact added and removed permissions', () => {
    const confirm = vi.fn();
    render(<RoleChangeSummary open saving={false} usersCount={12} onConfirm={confirm} onCancel={vi.fn()}
      changes={{
        previousName: 'Support', nextName: 'Moderators', changed: true,
        added: [{ id: 'audit', name: 'audit:read' }], removed: [{ id: 'user', name: 'user:read' }]
      }} />);
    expect(screen.getByText('Users assigned to this role when loaded: 12.')).toBeTruthy();
    expect(screen.getByText('Support → Moderators')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Added permissions: 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Removed permissions: 1' })).toBeTruthy();
    expect(screen.getByText('audit:read')).toBeTruthy();
    expect(screen.getByText('user:read')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    expect(confirm).toHaveBeenCalledOnce();
  });
});
