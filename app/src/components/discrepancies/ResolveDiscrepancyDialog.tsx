import { useState } from "react";
import { discrepancySubject } from "@/api/discrepancies";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ItemCombobox } from "@/components/inventory/ItemCombobox";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResolveDiscrepancyMutation } from "@/hooks/useDiscrepancies";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { Discrepancy, DiscrepancyResolution } from "@/types/discrepancy";
import type { Item } from "@/types/inventory";

const NOTE_MAX_LENGTH = 1000;

const RESOLVED_TOAST: Record<DiscrepancyResolution, string> = {
  accepted: "Discrepancy accepted.",
  redelivery_requested: "Redelivery requested.",
};

interface ResolveDiscrepancyDialogProps {
  discrepancy: Discrepancy;
  onClose: () => void;
}

function decisionHint(discrepancy: Discrepancy): string {
  if (discrepancy.type === "short") {
    return "Accept Discrepancy closes this line at the quantity received, so the document can close. Request Redelivery keeps the line open for the next delivery.";
  }
  return "Stock was already handled when it was received. Either choice only records your decision.";
}

export function ResolveDiscrepancyDialog({ discrepancy, onClose }: ResolveDiscrepancyDialogProps) {
  const mutation = useResolveDiscrepancyMutation();
  const [note, setNote] = useState("");
  const [linkedItem, setLinkedItem] = useState<Item | null>(null);
  const [decision, setDecision] = useState<DiscrepancyResolution | null>(null);
  const fieldErrors = getFieldErrors(mutation.error);
  const canLinkItem = discrepancy.item === null;

  function decide(resolution: DiscrepancyResolution) {
    setDecision(resolution);
    return mutation.mutateAsync(
      { id: discrepancy.id, resolution, note: note.trim() || null, itemId: linkedItem?.id ?? null },
      {
        onSuccess: () => {
          toast.success(RESOLVED_TOAST[resolution]);
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Resolve Discrepancy"
      size="sm"
      description={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={discrepancy.type} />
          <span className="font-semibold text-foreground">{discrepancySubject(discrepancy)}</span>
          {discrepancy.reference_number && <span className="font-mono">{discrepancy.reference_number}</span>}
        </span>
      }
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            variant="outline"
            disabled={mutation.isPending}
            isPending={mutation.isPending && decision === "redelivery_requested"}
            pendingText="Requesting…"
            onClick={() => decide("redelivery_requested")}
          >
            Request Redelivery
          </LoadingButton>
          <LoadingButton
            disabled={mutation.isPending}
            isPending={mutation.isPending && decision === "accepted"}
            pendingText="Accepting…"
            onClick={() => decide("accepted")}
          >
            Accept Discrepancy
          </LoadingButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, ["resolution_note", "item_id"])} />
        <p className="text-sm text-foreground-soft md:text-ui">{decisionHint(discrepancy)}</p>
        {discrepancy.notes && (
          <p className="text-sm text-foreground-soft md:text-ui">
            <span className="font-semibold">Logged note:</span> {discrepancy.notes}
          </p>
        )}
        {canLinkItem && (
          <FormField
            label="Link to Item"
            htmlFor="resolve-item"
            hint="Optional. Which item does this barcode belong to?"
            error={fieldErrors.item_id}
          >
            <ItemCombobox id="resolve-item" value={linkedItem} onChange={setLinkedItem} invalid={Boolean(fieldErrors.item_id)} />
          </FormField>
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
      </div>
    </ResponsiveDialog>
  );
}
