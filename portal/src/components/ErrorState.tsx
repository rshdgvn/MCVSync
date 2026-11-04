import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry: () => void;
}

export function ErrorState({ title = "This couldn't be loaded", message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 flex size-10 items-center justify-center bg-danger-muted text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground md:text-ui">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground md:text-ui">{message}</p>
      <Button className="mt-2" variant="outline" size="sm" onClick={onRetry}>
        <RotateCw />
        Retry
      </Button>
    </div>
  );
}
