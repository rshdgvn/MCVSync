import { useState } from "react";
import type { NotOnDocumentPayload } from "@/api/receiving";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { SubmitHandler } from "@/hooks/useSubmitOnce";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import type { Item } from "@/types/inventory";

const DISCREPANCY_FIELDS = ["scanned_quantity", "notes"] as const;

export interface NotOnDocumentSubject {
  item: Item | null;
  barcode: string | null;
}

interface NotOnDocumentDialogProps {
  subject: NotOnDocumentSubject;
  documentNumber: string;
  isPending: boolean;
  serverError: unknown;
  onSubmit: (payload: NotOnDocumentPayload) => ReturnType<SubmitHandler>;
  onClose: () => void;
}

export function NotOnDocumentDialog({ subject, documentNumber, isPending, serverError, onSubmit, onClose }: NotOnDocumentDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const fieldErrors = getFieldErrors(serverError);
  const isOnline = useOnlineStatus();
  const { item, barcode } = subject;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Not on This Document"
      description={
        <>
          {item ? (
            <span className="font-semibold text-foreground">{item.name}</span>
          ) : (
            <>
              Barcode <span className="font-mono font-semibold text-foreground">{barcode}</span>
            </>
          )}{" "}
          isn't on{" "}
          <span className="font-mono">{documentNumber}</span>. It won't be added to stock. Log a discrepancy so it can be
          followed up.
        </>
      }
      footer={
        <>
          <Button variant="outline" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="not-on-document-form" isPending={isPending} pendingText="Logging…">
            {isOnline ? "Log Discrepancy" : "Queue Discrepancy"}
          </LoadingButton>
        </>
      }
    >
      <SubmitForm
        id="not-on-document-form"
        onSubmit={() =>
          onSubmit({ itemId: item?.id ?? null, scannedBarcode: barcode, scannedQuantity: quantity, notes: notes.trim() || null })
        }
        className="flex flex-col gap-3"
      >
        <FormError message={getGeneralError(serverError, DISCREPANCY_FIELDS)} />
        <FormField label="Quantity Delivered" htmlFor="not-on-document-quantity" error={fieldErrors.scanned_quantity}>
          <QuantityInput id="not-on-document-quantity" label="Quantity delivered" min={1} value={quantity} onChange={setQuantity} />
        </FormField>
        <FormField label="Notes" htmlFor="not-on-document-notes" error={fieldErrors.notes}>
          <Textarea
            {...fieldA11yProps("not-on-document-notes", fieldErrors.notes)}
            rows={2}
            placeholder="What arrived, and what should happen to it?"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
