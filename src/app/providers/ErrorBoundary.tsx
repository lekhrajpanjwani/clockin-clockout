import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { captureError } from "../../lib/monitoring";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Top-level error boundary. Catches render-time errors anywhere below it in
 * the tree and shows a recoverable fallback instead of a blank white screen.
 * Network errors from TanStack Query are handled separately per-query (they
 * don't throw during render), so this is specifically the last resort for
 * unexpected bugs. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
    captureError(error, { componentStack: info.componentStack });
  }

  private handleReset = () => {
    this.setState({ error: null });
    window.location.assign("/");
  };

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Your attendance data is safe — this only affects the current screen.
          </p>
          <Button onClick={this.handleReset}>Reload Punchcard</Button>
        </div>
      </div>
    );
  }
}
