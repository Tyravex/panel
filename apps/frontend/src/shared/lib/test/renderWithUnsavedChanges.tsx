import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { UnsavedChangesProvider } from '@/app/providers/UnsavedChangesProvider';

export const renderWithUnsavedChanges = (children: ReactNode) => render(
  <RouterProvider router={createMemoryRouter([
    { path: '*', element: <UnsavedChangesProvider>{children}</UnsavedChangesProvider> },
  ])} />,
);
