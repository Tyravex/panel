import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { QueryProvider } from './QueryProvider';

export const AppProviders = ({ children }: { children: ReactNode }) => <ThemeProvider><QueryProvider>{children}</QueryProvider></ThemeProvider>;
