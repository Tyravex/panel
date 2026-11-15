// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { AdminServiceEditor } from './AdminServiceEditor';

const mocks = vi.hoisted(() => ({ create: vi.fn(), nodes: vi.fn(), navigate: vi.fn(), translate: (key: string) => key }));
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock('@/app/store/auth.store', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { permissions: ['service:read:any', 'service:create'] } }) }));
vi.mock('@/features/nodes/api/nodesApi', () => ({ nodesApi: { list: mocks.nodes } }));
vi.mock('../api/adminServicesApi', () => ({
  adminServicesApi: {
    createDraft: mocks.create,
    eggs: () => Promise.resolve([{ id: 'game-egg', name: 'Game', version: '1.0.0', manifest: { category: 'server', runtime: { image: 'alpine:3.21', startup: 'echo test' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 } } }]),
  }
}));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: 'new-service' }); });

describe('Administrative service editor', () => {
  it('saves the selected Egg with the draft in one API request without inaccessible node lookups', async () => {
    renderWithUnsavedChanges(<AdminServiceEditor />);
    await screen.findByRole('option', { name: 'Game — 1.0.0' });
    fireEvent.change(screen.getByRole('textbox', { name: 'adminServices.name' }), { target: { value: 'Game service' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Egg' }), { target: { value: 'game-egg' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Game service', eggId: 'game-egg', userId: null })));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.nodes).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/services/new-service');
  });
  it('preserves drafts when replacing resource limits is cancelled', async () => {
    renderWithUnsavedChanges(<AdminServiceEditor />);
    await screen.findByRole('option', { name: 'Game — 1.0.0' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Egg' }), { target: { value: 'game-egg' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'adminServices.resources.memoryMb' }), { target: { value: '2048' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminServices.applyEggDefaults' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.cancel' }));
    expect((screen.getByRole('spinbutton', { name: 'adminServices.resources.memoryMb' }) as HTMLInputElement).value).toBe('2048');
  });
});
