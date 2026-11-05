import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { ReceiveLinePayload, ReceivingLine } from "@/api/receiving";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { MicroLabel } from "@/components/MicroLabel";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SubmitHandler } from "@/hooks/useSubmitOnce";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";

const RECEIVE_FIELDS = ["quantity_received", "batch_number", "mfg_date", "expiry_date"] as const;

type ReceiveField = (typeof RECEIVE_FIELDS)[number];

const BATCH_MAX_LENGTH = 255;

interface ReceiveLineDialogProps {
  line: ReceivingLine;
  remaining: number;
  isPending: boolean;
  serverError: unknown;
  onSubmit: (payload: ReceiveLinePayload) => ReturnType<SubmitHandler>;
  onClose: () => void;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function ReceiveLineDialog({ line, remaining, isPending, serverError, onSubmit, onClose }: ReceiveLineDialogProps) {
  const unit = line.item.unit?.code;
  const [quantity, setQuantity] = useState(Math.max(remaining, 1));
  const [batchNumber, setBatchNumber] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [clientErrors, setClientErrors] = useState<Partial<Record<ReceiveField, string>>>({});
  const fieldErrors: Partial<Record<ReceiveField, string>> = { ...getFieldErrors(serverError), ...clientErrors };
  const overBy = quantity - remaining;

  function handleSubmit() {
    const errors: Partial<Record<ReceiveField, string>> = {};
    if (!batchNumber.trim()) {
      errors.batch_number = "Enter the batch number printed on the delivery.";
    }
    if (line.item.has_expiry && !expiryDate) {
      errors.expiry_date = "Expiry date is required for this item.";
    }
    if (mfgDate && expiryDate && mfgDate > expiryDate) {
      errors.mfg_date = "The manufacture date can't be after the expiry date.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    return onSubmit({
      lineId: line.id,
      quantity,
      batchNumber: batchNumber.trim(),
      mfgDate: blankToNull(mfgDate),
      expiryDate: line.item.has_expiry ? expiryDate : blankToNull(expiryDate),
    });
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !isPending && onClose()}
      title="Item Found"
      description={
        <>
          <span className="font-semibold text-foreground">{line.item.name}</span>{" "}
          <span className="font-mono text-xs">{line.item.sku}</span>
        </>
      }
      footer={
        <>
          <Button variant="outline" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="receive-line-form" isPending={isPending} pendingText="Receiving…">
            Confirm Receipt
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="receive-line-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(serverError, RECEIVE_FIELDS)} />
        <dl className="grid grid-cols-3 gap-2 border border-border-subtle bg-subtle px-3 py-2.5">
          {[
            { label: "Ordered", value: line.expected },
            { label: "Received So Far", value: line.received },
            { label: "Remaining", value: remaining },
          ].map((stat) => (
            <div key={stat.label} className="grid gap-0.5">
              <dt>
                <MicroLabel>{stat.label}</MicroLabel>
              </dt>
              <dd className="font-mono text-sm font-semibold text-foreground">{formatQuantity(stat.value, unit)}</dd>
            </div>
          ))}
        </dl>

        <FormField label="Quantity" htmlFor="receive-quantity" required error={fieldErrors.quantity_received}>
          <QuantityInput id="receive-quantity" label="Quantity" min={1} value={quantity} onChange={setQuantity} />
        </FormField>
        {overBy > 0 && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              This is {formatQuantity(overBy, unit)} more than remaining. An over discrepancy will be logged.
            </AlertDescription>
          </Alert>
        )}
        <FormField label="Batch No." htmlFor="receive-batch" required error={fieldErrors.batch_number}>
          <Input
            {...fieldA11yProps("receive-batch", fieldErrors.batch_number)}
            autoFocus
            autoComplete="off"
            maxLength={BATCH_MAX_LENGTH}
            className="font-mono"
            value={batchNumber}
            onChange={(event) => setBatchNumber(event.target.value)}
          />
        </FormField>
        <FormField label="MFG Date" htmlFor="receive-mfg" error={fieldErrors.mfg_date}>
          <Input
            {...fieldA11yProps("receive-mfg", fieldErrors.mfg_date)}
            type="date"
            className="md:w-48"
            value={mfgDate}
            onChange={(event) => setMfgDate(event.target.value)}
          />
        </FormField>
        {line.item.has_expiry && (
          <FormField label="Expiry Date" htmlFor="receive-expiry" required error={fieldErrors.expiry_date}>
            <Input
              {...fieldA11yProps("receive-expiry", fieldErrors.expiry_date)}
              type="date"
              className="md:w-48"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
            />
          </FormField>
        )}
      </SubmitForm>
    </ResponsiveDialog>
  );
}
