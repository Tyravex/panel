// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { AdminRegionsPage } from './AdminRegionsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
vi.mock('@/features/regions/api/regionsApi', () => ({ regionsApi: {
  list: () => Promise.resolve([{ id: 'eu', name: 'Europe', code: 'eu', description: '', _count: { locations: 0, nodes: 0 } }]),
} }));
afterEach(cleanup);

describe('Region form drafts', () => {
  it('does not warn on opening an existing record and protects local cancellation after edits', async () => {
    renderWithUnsavedChanges(<AdminRegionsPage />);
    await screen.findByText('Europe');
    fireEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByDisplayValue('Europe'), { target: { value: 'Europe changed' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Anuluj' })[0]);
    const dialog = within(screen.getByRole('alertdialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'common.cancel' }));
    expect(screen.getByDisplayValue('Europe changed')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Anuluj' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'common.unsaved.discard' }));
    expect(screen.queryByDisplayValue('Europe changed')).toBeNull();
  });
});
