import { createContext } from 'react';

export interface UnsavedChangesContextValue {
  register: (id: string, dirty: boolean) => void;
  blocked: boolean;
  discard: () => void;
  stay: () => void;
  requestAction: (action: () => void) => void;
}

export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);
