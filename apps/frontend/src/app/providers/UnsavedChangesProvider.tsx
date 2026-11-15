import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UnsavedChangesContext } from '@/shared/lib/unsavedChangesContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

/** One blocker coordinates all forms, including pages with multiple editors. */
export const UnsavedChangesProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const dirtyForms = useRef(new Set<string>());
  const pendingAction = useRef<(() => void) | null>(null);
  const bypass = useRef(false);
  const [localBlocked, setLocalBlocked] = useState(false);
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtyForms.current.add(id); else dirtyForms.current.delete(id);
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !bypass.current && dirtyForms.current.size > 0 && (
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search || currentLocation.hash !== nextLocation.hash
    ),
  );
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (!dirtyForms.current.size) return;
    event.preventDefault();
    event.returnValue = '';
  }, []));
  const stay = () => {
    pendingAction.current = null;
    setLocalBlocked(false);
    if (blocker.state === 'blocked') blocker.reset();
  };
  const discard = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setLocalBlocked(false);
    if (blocker.state === 'blocked') blocker.proceed();
    else if (action) {
      bypass.current = true;
      try { action(); } finally { bypass.current = false; }
    }
  };
  const blocked = localBlocked || blocker.state === 'blocked';
  return <UnsavedChangesContext.Provider value={{
    register, blocked, stay, discard,
    requestAction: (action) => {
      if (!dirtyForms.current.size) action();
      else { pendingAction.current = action; setLocalBlocked(true); }
    },
  }}>
    {children}
    <ConfirmDialog open={blocked} destructive title={t('common.unsaved.title')}
      description={t('common.unsaved.description')} confirmLabel={t('common.unsaved.discard')}
      onCancel={stay} onConfirm={discard} />
  </UnsavedChangesContext.Provider>;
};
