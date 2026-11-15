import { useContext, useEffect, useId } from 'react';
import { UnsavedChangesContext } from './unsavedChangesContext';

/** Register one form with the shared navigation guard. */
export const useUnsavedChanges = (dirty: boolean) => {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error('UnsavedChangesProvider is required');
  const { register, ...guard } = context;
  const id = useId();
  useEffect(() => {
    register(id, dirty);
    return () => register(id, false);
  }, [id, dirty, register]);
  return {
    ...guard,
    markSaved: () => register(id, false),
  };
};
