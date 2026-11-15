// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { EggManifestEditor } from './EggManifestEditor';

const mocks = vi.hoisted(() => ({ validate: vi.fn(), importEgg: vi.fn(), navigate: vi.fn(), translate: (key: string) => key }));
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock('../api/eggsApi', () => ({ eggsApi: { validate: mocks.validate, import: mocks.importEgg } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.validate.mockResolvedValue({}); mocks.importEgg.mockResolvedValue({ id: 'new-egg' }); });
const setup = () => renderWithUnsavedChanges(<EggManifestEditor repositories={[{ id: 'repo', name: 'Catalog', url: 'https://example.com/index.json', status: 'ENABLED', isOfficial: false }]} />);

describe('Egg manifest validation and import', () => {
  it('requires server validation and invalidates the preview after further edits', async () => {
    setup();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'repo' } });
    expect((screen.getByRole('button', { name: 'eggs.import' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'eggs.validate' }));
    await screen.findByRole('heading', { name: 'eggs.preview' });
    expect((screen.getByRole('button', { name: 'eggs.import' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: 'eggs.manifest' }), { target: { value: '{}' } });
    expect((screen.getByRole('button', { name: 'eggs.import' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.importEgg).not.toHaveBeenCalled();
  });
  it('imports the exact validated manifest and returns to the new Egg', async () => {
    setup();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'repo' } });
    fireEvent.click(screen.getByRole('button', { name: 'eggs.validate' }));
    await screen.findByRole('heading', { name: 'eggs.preview' });
    fireEvent.click(screen.getByRole('button', { name: 'eggs.import' }));
    await waitFor(() => expect(mocks.importEgg).toHaveBeenCalledWith('repo', expect.objectContaining({ format: 'tyravex-egg', version: '1.0.0' })));
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/eggs/new-egg');
  });
});
