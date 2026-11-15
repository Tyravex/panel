// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { ServiceEnvironmentEditor } from './ServiceEnvironmentEditor';
import type { AdminService } from '../api/adminServicesApi';

const mocks = vi.hoisted(() => ({ metadata: vi.fn(), save: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../api/adminServicesApi', () => ({ adminServicesApi: { environment: mocks.metadata, saveEnvironment: mocks.save } }));
const service = { id: 'service-1', egg: { manifest: { variables: [{ name: 'TOKEN', required: true, secret: true }] } } } as AdminService;
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.metadata.mockResolvedValue({ configured: ['TOKEN'], required: ['TOKEN'], missing: [] }); mocks.save.mockResolvedValue({ configured: ['TOKEN'] }); });

describe('Service environment form', () => {
  it('never prefills a stored secret and sends only explicit replacements', async () => {
    renderWithUnsavedChanges(<ServiceEnvironmentEditor service={service} />);
    const input = await screen.findByLabelText(/TOKEN/);
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    expect((input as HTMLInputElement).value).toBe('');
    expect(input.getAttribute('type')).toBe('password');
    fireEvent.change(input, { target: { value: 'new-private-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('service-1', { TOKEN: 'new-private-token' }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });
  it('requires an explicit remove action to send null', async () => {
    renderWithUnsavedChanges(<ServiceEnvironmentEditor service={service} />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'adminServices.removeValue' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'adminServices.removeValue' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('service-1', { TOKEN: null }));
  });
});
