import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, TimerOff } from "lucide-react";
import { FormError } from "@/components/FormError";
import { LoadingButton } from "@/components/LoadingButton";
import { MicroLabel } from "@/components/MicroLabel";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useGenerateFefoOverrideMutation } from "@/hooks/useTransfers";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast.store";
import type { FefoOverrideCode } from "@/types/transfer";

export const Route = createFileRoute("/_authenticated/super-admin/fefo-override")({
  beforeLoad: requireRole("super_admin"),
  component: FefoOverridePage,
});

const SECOND_MS = 1000;

function secondsUntil(isoDate: string, now: number): number {
  return Math.max(0, Math.floor((Date.parse(isoDate) - now) / SECOND_MS));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(interval);
  }, [active]);

  return now;
}

function FefoOverridePage() {
  const mutation = useGenerateFefoOverrideMutation();
  const [override, setOverride] = useState<FefoOverrideCode | null>(null);
  const now = useNow(override !== null);
  const secondsLeft = override ? secondsUntil(override.expires_at, now) : 0;
  const expired = override !== null && secondsLeft === 0;

  function generate() {
    return mutation.mutateAsync(undefined, { onSuccess: setOverride });
  }

  async function copyCode() {
    if (!override) {
      return;
    }
    try {
      await navigator.clipboard.writeText(override.code);
      toast.success("Code copied.");
    } catch {
      toast.error("Couldn't copy. Read the code out instead.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="FEFO Override Codes"
        description="Give a picker a one-time code to take a batch out of first-expiry-first-out order. Each code works once and expires after 15 minutes."
      />

      <section className="flex flex-col items-center gap-4 border border-border bg-card px-4 py-8 text-center md:max-w-xl">
        {override ? (
          <>
            <MicroLabel>{expired ? "Expired Code" : "Override Code"}</MicroLabel>
            <p
              aria-live="polite"
              className={cn(
                "font-mono text-4xl font-extrabold tracking-[0.25em] md:text-5xl",
                expired ? "text-faint line-through" : "text-foreground",
              )}
            >
              {override.code}
            </p>
            {expired ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-danger">
                <TimerOff className="size-4" />
                This code has expired. Generate a new one.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Expires in <span className="font-mono font-semibold text-foreground">{formatCountdown(secondsLeft)}</span>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {!expired && (
                <Button variant="outline" onClick={() => void copyCode()}>
                  <Copy />
                  Copy Code
                </Button>
              )}
              <LoadingButton onClick={generate} isPending={mutation.isPending} pendingText="Generating…">
                <KeyRound />
                Generate New Code
              </LoadingButton>
            </div>
          </>
        ) : (
          <>
            <KeyRound className="size-8 text-faint" />
            <p className="max-w-sm text-sm text-muted-foreground md:text-ui">
              Generate a code only when a picker asks for one, then read it to them directly.
            </p>
            <LoadingButton onClick={generate} isPending={mutation.isPending} pendingText="Generating…">
              <KeyRound />
              Generate Code
            </LoadingButton>
          </>
        )}
        <FormError message={mutation.isError ? getErrorMessage(mutation.error) : null} />
      </section>
    </div>
  );
}
