import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./app/providers/ErrorBoundary";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { QueryProvider } from "./app/providers/QueryProvider";
import { AuthProvider } from "./app/providers/AuthProvider";
import { Toaster } from "./components/feedback/Toaster";
import { router } from "./routes";

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
