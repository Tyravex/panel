import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppRoutes } from "./routes";
import { UnsavedChangesProvider } from '@/app/providers/UnsavedChangesProvider';

const router = createBrowserRouter([{ path: "*", element: <UnsavedChangesProvider><AppRoutes /></UnsavedChangesProvider> }]);

export const AppRouter = () => (
  <RouterProvider router={router} />
);
