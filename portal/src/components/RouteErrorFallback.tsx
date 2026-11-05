import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ErrorState } from "@/components/ErrorState";

export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="border border-border bg-card">
      <ErrorState
        title="This page couldn't be loaded"
        message={message}
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </div>
  );
}
