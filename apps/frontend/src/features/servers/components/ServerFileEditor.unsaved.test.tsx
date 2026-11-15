// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { ServerFileEditor } from './ServerFileEditor';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <textarea aria-label="File content" value={value} onChange={(event) => onChange(event.target.value)} />,
}));
afterEach(cleanup);
const warns = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('File editor draft protection', () => {
  it('protects content, confirms reset and uses the last saved content as baseline', () => {
    const save = vi.fn();
    renderWithUnsavedChanges(<ServerFileEditor fileName="config.json" filePath="/config.json"
      initialContent="initial" isDemoMode onBack={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft' } });
    expect(warns()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'servers.files.editorUi.reset' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.cancel' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('draft');
    fireEvent.click(screen.getByRole('button', { name: 'servers.files.editorUi.save' }));
    expect(save).toHaveBeenCalledWith('draft');
    expect(warns()).toBe(false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'another draft' } });
    expect(warns()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'servers.files.editorUi.reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.unsaved.discard' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('draft');
    expect(warns()).toBe(false);
  });
});
