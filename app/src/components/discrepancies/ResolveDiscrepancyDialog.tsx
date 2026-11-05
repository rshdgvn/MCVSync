import { useState } from "react";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResolveDiscrepancyMutation } from "@/hooks/useDiscrepancies";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { Discrepancy } from "@/types/discrepancy";

const NOTE_MAX_LENGTH = 1000;

interface ResolveDiscrepancyDialogProps {
  discrepancy: Discrepancy;
  onClose: () => void;
}

export function ResolveDiscrepancyDialog({ discrepancy, onClose }: ResolveDiscrepancyDialogProps) {
  const mutation = useResolveDiscrepancyMutation();
  const [note, setNote] = useState("");
  const fieldErrors = getFieldErrors(mutation.error);

  function handleSubmit() {
    return mutation.mutateAsync(
      { id: discrepancy.id, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success("Discrepancy resolved.");
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Resolve Discrepancy?"
      size="sm"
      description={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={discrepancy.type} />
          <span className="font-semibold text-foreground">{discrepancy.item?.name ?? "Unknown item"}</span>
          {discrepancy.reference_number && <span className="font-mono">{discrepancy.reference_number}</span>}
        </span>
      }
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="resolve-discrepancy-form" isPending={mutation.isPending} pendingText="Resolving…">
            Mark Resolved
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="resolve-discrepancy-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, ["resolution_note"])} />
        {discrepancy.notes && (
          <p className="text-sm text-foreground-soft md:text-ui">
            <span className="font-semibold">Logged note:</span> {discrepancy.notes}
          </p>
        )}
        <FormField label="Resolution Note" htmlFor="resolution-note" hint="Optional. How was this settled?" error={fieldErrors.resolution_note}>
          <Textarea
            {...fieldA11yProps("resolution-note", fieldErrors.resolution_note)}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
