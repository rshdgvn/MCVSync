import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background p-4">
          <div className="w-full max-w-md border border-border bg-card">
            <ErrorState
              title="Something went wrong"
              message="The app hit an unexpected error. Reload to continue; if it keeps happening, contact support."
              onRetry={() => window.location.reload()}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
