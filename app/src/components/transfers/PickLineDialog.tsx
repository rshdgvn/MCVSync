import { useState } from "react";
import { Check, Layers } from "lucide-react";
import type { PickPayload } from "@/api/transfers";
import { ExpiryChip } from "@/components/ExpiryChip";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { MicroLabel } from "@/components/MicroLabel";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StockFlowLine } from "@/components/stock-flow/stockFlowLines";
import { useItemBatchesQuery } from "@/hooks/useInventory";
import type { SubmitHandler } from "@/hooks/useSubmitOnce";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Batch } from "@/types/inventory";

const PICK_FIELDS = ["quantity", "batch_id", "override_code", "override_reason"] as const;

type PickField = (typeof PICK_FIELDS)[number];

const OVERRIDE_CODE_LENGTH = 8;
const REASON_MAX_LENGTH = 1000;

interface PickLineDialogProps {
  line: StockFlowLine;
  remaining: number;
  suggestedBatch: Batch | null;
  fulfillingBranchId: number;
  isPending: boolean;
  serverError: unknown;
  onSubmit: (payload: PickPayload) => ReturnType<SubmitHandler>;
  onClose: () => void;
}

function defaultQuantity(remaining: number, batch: Batch | null): number {
  return Math.max(1, batch ? Math.min(remaining, batch.quantity) : remaining);
}

function BatchSummary({ batch, thresholdDays, label }: { batch: Batch; thresholdDays: number; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border-subtle bg-subtle px-3 py-2.5">
      <MicroLabel className="w-full">{label}</MicroLabel>
      <span className="font-mono text-sm font-semibold">{batch.batch_number}</span>
      <ExpiryChip expiryDate={batch.expiry_date} thresholdDays={thresholdDays} />
      <span className="text-xs text-muted-foreground">{batch.quantity} available</span>
    </div>
  );
}

export function PickLineDialog({
  line,
  remaining,
  suggestedBatch,
  fulfillingBranchId,
  isPending,
  serverError,
  onSubmit,
  onClose,
}: PickLineDialogProps) {
  const unit = line.item.unit?.code;
  const thresholdDays = line.item.effective_expiry_alert_threshold_days;
  const [quantity, setQuantity] = useState(defaultQuantity(remaining, suggestedBatch));
  const [choosingBatch, setChoosingBatch] = useState(false);
  const [chosenBatch, setChosenBatch] = useState<Batch | null>(null);
  const [overrideCode, setOverrideCode] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [clientErrors, setClientErrors] = useState<Partial<Record<PickField, string>>>({});
  const batchesQuery = useItemBatchesQuery(line.item.id, 1, choosingBatch);
  const batchChoices = (batchesQuery.data?.data ?? []).filter(
    (batch) => batch.status === "active" && batch.quantity > 0 && (batch.branch?.id ?? fulfillingBranchId) === fulfillingBranchId,
  );
  const pickBatch = chosenBatch ?? suggestedBatch;
  const needsOverride = chosenBatch !== null && suggestedBatch !== null && chosenBatch.expiry_date !== suggestedBatch.expiry_date;
  const fieldErrors: Partial<Record<PickField, string>> = { ...getFieldErrors(serverError), ...clientErrors };

  function chooseBatch(batch: Batch) {
    setChosenBatch(batch.id === suggestedBatch?.id ? null : batch);
    setQuantity(defaultQuantity(remaining, batch));
    setChoosingBatch(false);
  }

  function handleSubmit() {
    const errors: Partial<Record<PickField, string>> = {};
    if (needsOverride && overrideCode.length !== OVERRIDE_CODE_LENGTH) {
      errors.override_code = "Enter the 8-character code from the Super Admin.";
    }
    if (needsOverride && !overrideReason.trim()) {
      errors.override_reason = "Say why this batch is being picked out of FEFO order.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    return onSubmit({
      item_id: line.item.id,
      quantity,
      batch_id: chosenBatch?.id ?? null,
      override_code: needsOverride ? overrideCode : null,
      override_reason: needsOverride ? overrideReason.trim() : null,
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
          <LoadingButton type="submit" form="pick-line-form" disabled={!pickBatch} isPending={isPending} pendingText="Picking…">
            Confirm Pick
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="pick-line-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(serverError, PICK_FIELDS)} />
        <dl className="grid grid-cols-3 gap-2 border border-border-subtle bg-subtle px-3 py-2.5">
          {[
            { label: "Requested", value: line.target },
            { label: "Picked", value: line.done },
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

        {pickBatch ? (
          <BatchSummary
            batch={pickBatch}
            thresholdDays={thresholdDays}
            label={chosenBatch ? "Chosen Batch" : "FEFO Batch (Earliest Expiry)"}
          />
        ) : (
          <FormError message="No stock left for this item at the fulfilling branch." />
        )}

        {pickBatch && pickBatch.quantity < remaining && (
          <p className="text-xs text-muted-foreground">
            This batch has {formatQuantity(pickBatch.quantity, unit)}. Pick it, then pick the rest from the next batch.
          </p>
        )}

        <FormField label="Quantity" htmlFor="pick-quantity" required error={fieldErrors.quantity}>
          <QuantityInput
            id="pick-quantity"
            label="Quantity"
            min={1}
            max={Math.max(1, Math.min(remaining, pickBatch?.quantity ?? remaining))}
            value={quantity}
            onChange={setQuantity}
          />
        </FormField>

        {suggestedBatch && (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={choosingBatch}
              onClick={() => setChoosingBatch((open) => !open)}
            >
              <Layers />
              Use a different batch
            </Button>
            {choosingBatch && (
              <div className="border border-border">
                <MicroLabel className="border-b border-border-subtle px-3 py-2">Batches (Earliest Expiry First)</MicroLabel>
                {batchesQuery.isPending ? (
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <ul className="max-h-56 divide-y divide-border-subtle overflow-y-auto">
                    {batchChoices.map((batch) => (
                      <li key={batch.id}>
                        <button
                          type="button"
                          onClick={() => chooseBatch(batch)}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle",
                            pickBatch?.id === batch.id && "bg-primary-light",
                          )}
                        >
                          <span className="font-mono text-sm font-semibold">{batch.batch_number}</span>
                          <ExpiryChip expiryDate={batch.expiry_date} thresholdDays={thresholdDays} />
                          <span className="ml-auto text-xs text-muted-foreground">{batch.quantity} available</span>
                          {pickBatch?.id === batch.id && <Check className="size-4 shrink-0 text-primary" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {needsOverride && (
          <>
            <p className="text-xs text-warning">
              This batch expires later than the FEFO batch. Picking it needs a Super Admin override code and a reason.
            </p>
            <FormField label="Override Code" htmlFor="pick-override-code" required error={fieldErrors.override_code}>
              <Input
                {...fieldA11yProps("pick-override-code", fieldErrors.override_code)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={OVERRIDE_CODE_LENGTH}
                className="font-mono tracking-[0.2em] uppercase md:w-40"
                value={overrideCode}
                onChange={(event) => setOverrideCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
            </FormField>
            <FormField label="Reason" htmlFor="pick-override-reason" required error={fieldErrors.override_reason}>
              <Textarea
                {...fieldA11yProps("pick-override-reason", fieldErrors.override_reason)}
                rows={2}
                maxLength={REASON_MAX_LENGTH}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
            </FormField>
          </>
        )}
      </SubmitForm>
    </ResponsiveDialog>
  );
}
