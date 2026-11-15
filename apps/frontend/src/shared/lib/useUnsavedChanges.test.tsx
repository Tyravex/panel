import { UnsavedChangesProvider } from '@/app/providers/UnsavedChangesProvider';
// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router-dom';
import { useUnsavedChanges } from './useUnsavedChanges';

afterEach(cleanup);
const Form = () => {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const guard = useUnsavedChanges(name.length > 0);
  return <>
    <input aria-label="Role name" value={name} onChange={(event) => setName(event.target.value)} />
    <Link to="/other">Other page</Link>
    <button onClick={() => navigate('/other')}>Cancel form</button>
    <button onClick={() => { guard.markSaved(); navigate('/other'); }}>Successful save</button>
    {guard.blocked && <div role="dialog">
      <button onClick={guard.stay}>Stay</button><button onClick={guard.discard}>Discard</button>
    </div>}
  </>;
};
const setup = () => {
  const router = createMemoryRouter([
    { path: '/form', element: <UnsavedChangesProvider><Form /></UnsavedChangesProvider> }, { path: '/other', element: <h1>Destination</h1> },
  ], { initialEntries: ['/other', '/form'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  return router;
};
const edit = () => fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed' } });

describe('Unsaved changes navigation guard', () => {
  it('allows leaving an unchanged form', async () => {
    setup();
    fireEvent.click(screen.getByRole('link'));
    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeTruthy();
  });

  it('blocks links, preserves edits on Stay, and proceeds only after Discard', async () => {
    setup(); edit();
    fireEvent.click(screen.getByRole('link'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Destination' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Changed');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel form' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeTruthy();
  });

  it('blocks browser history navigation and can cancel it', async () => {
    const router = setup(); edit();
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/form');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/form');
  });

  it('requests a native unload warning only while dirty and removes it after reverting', () => {
    setup();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    edit();
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    const reverted = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reverted);
    expect(reverted.defaultPrevented).toBe(false);
  });

  it('bypasses confirmation after a successful save', async () => {
    setup(); edit();
    fireEvent.click(screen.getByRole('button', { name: 'Successful save' }));
    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
