import { Link, type LinkProps } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";

const NOT_FOUND = 404;

interface DetailLoadErrorProps {
  error: unknown;
  onRetry: () => void;
  backTo: LinkProps["to"];
  backLabel: string;
  entityLabel: string;
}

export function DetailLoadError({ error, onRetry, backTo, backLabel, entityLabel }: DetailLoadErrorProps) {
  const notFound = isAxiosError(error) && error.response?.status === NOT_FOUND;

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader backTo={backTo} backLabel={backLabel} title={entityLabel} />
      <div className="border border-border bg-card">
        {notFound ? (
          <EmptyState
            title={`${entityLabel} not found`}
            description={`The link may be wrong. Go back to ${backLabel} to find it.`}
            action={
              <Button size="sm" variant="outline" render={<Link to={backTo} />}>
                Back to {backLabel}
              </Button>
            }
          />
        ) : (
          <ErrorState
            title={`This ${entityLabel.toLowerCase()} couldn't be loaded`}
            message={getErrorMessage(error)}
            onRetry={onRetry}
          />
        )}
      </div>
    </div>
  );
}
