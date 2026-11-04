import type { ReactNode } from "react";
import { FormError } from "@/components/FormError";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  destructive?: boolean;
  error?: string | null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending = false,
  destructive = false,
  error,
}: ConfirmDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            variant={destructive ? "destructive" : "default"}
            isPending={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-3 text-sm text-foreground-soft md:text-ui">
        <div>{description}</div>
        <FormError message={error} />
      </div>
    </ResponsiveDialog>
  );
}
