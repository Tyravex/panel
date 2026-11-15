// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithUnsavedChanges } from '@/shared/lib/test/renderWithUnsavedChanges';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const Form = ({ label }: { label: string }) => {
  const [value, setValue] = useState('');
  const [baseline, setBaseline] = useState('');
  const guard = useUnsavedChanges(value !== baseline);
  return <section>
    <input aria-label={label} value={value} onChange={(event) => setValue(event.target.value)} />
    <button onClick={() => { setBaseline(value); guard.markSaved(); }}>Save {label}</button>
    <button onClick={() => guard.requestAction(() => setValue(baseline))}>Reset {label}</button>
  </section>;
};
const warns = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('Multiple unsaved forms', () => {
  it('keeps protection for other forms and protects new edits after a save', () => {
    renderWithUnsavedChanges(<><Form label="A" /><Form label="B" /></>);
    fireEvent.change(screen.getByLabelText('A'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('B'), { target: { value: 'b' } });
    fireEvent.click(screen.getByText('Save A'));
    expect(warns()).toBe(true);
    fireEvent.click(screen.getByText('Save B'));
    expect(warns()).toBe(false);
    fireEvent.change(screen.getByLabelText('A'), { target: { value: 'new a' } });
    expect(warns()).toBe(true);
  });

  it('confirms local destructive actions and preserves data when cancelled', () => {
    renderWithUnsavedChanges(<Form label="A" />);
    fireEvent.change(screen.getByLabelText('A'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByText('Reset A'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.cancel' }));
    expect((screen.getByLabelText('A') as HTMLInputElement).value).toBe('draft');
    fireEvent.click(screen.getByText('Reset A'));
    fireEvent.click(screen.getByRole('button', { name: 'common.unsaved.discard' }));
    expect((screen.getByLabelText('A') as HTMLInputElement).value).toBe('');
    expect(warns()).toBe(false);
  });
});
