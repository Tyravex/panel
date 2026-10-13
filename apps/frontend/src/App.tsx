import { QueryProvider, ThemeProvider } from "@/app/providers";
import { AppRouter } from "@/app/router/RouterProvider";

function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </ThemeProvider>
  );
}

export default App;