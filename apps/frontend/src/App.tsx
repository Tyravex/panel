import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/RouterProvider';
import { useAppBootstrap } from '@/app/bootstrap/useAppBootstrap';

export default function App() {
  const ready = useAppBootstrap();
  if (!ready) return <div role="status" aria-live="polite">Loading...</div>;
  return <AppProviders><AppRouter /></AppProviders>;
}
