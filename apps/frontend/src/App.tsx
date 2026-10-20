import { useEffect, useState } from 'react';

import { QueryProvider, ThemeProvider } from '@/app/providers';
import { AppRouter } from '@/app/router/RouterProvider';
import { useUser } from '@/shared/store/user';

function App() {
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initializeLanguage = async () => {
      try {
        await useUser.getState().syncActiveLanguage();
      } catch (error) {
        console.error('Failed to initialize language:', error);
      } finally {
        if (!cancelled) {
          setIsLanguageReady(true);
        }
      }
    };

    void initializeLanguage();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isLanguageReady) {
    return (
      <div role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  return (
    <ThemeProvider>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </ThemeProvider>
  );
}

export default App;
