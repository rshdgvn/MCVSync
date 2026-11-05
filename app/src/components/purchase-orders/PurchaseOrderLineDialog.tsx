import { useState } from "react";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { ItemCombobox } from "@/components/inventory/ItemCombobox";
import { LoadingButton } from "@/components/LoadingButton";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lineTotal } from "@/components/purchase-orders/purchaseOrderRules";
import type { SubmitHandler } from "@/hooks/useSubmitOnce";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import type { Item } from "@/types/inventory";

export interface PurchaseOrderLineDraft {
  item: Item;
  quantity: number;
  unitCost: number;
  discount: number;
}

interface PurchaseOrderLineDialogProps {
  title: string;
  submitLabel: string;
  initial?: Partial<PurchaseOrderLineDraft>;
  itemLocked?: boolean;
  isPending?: boolean;
  serverError?: unknown;
  onSubmit: (line: PurchaseOrderLineDraft) => ReturnType<SubmitHandler>;
  onClose: () => void;
}

const LINE_FIELDS = ["item_id", "quantity_ordered", "unit_cost", "discount"] as const;

type LineField = (typeof LINE_FIELDS)[number];

function toMoneyInput(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseMoney(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validate(
  item: Item | null,
  quantity: number,
  unitCost: number | null,
  discount: number | null,
): Partial<Record<LineField, string>> {
  const errors: Partial<Record<LineField, string>> = {};
  if (!item) {
    errors.item_id = "Choose an item.";
  }
  if (quantity < 1) {
    errors.quantity_ordered = "Order at least 1.";
  }
  if (unitCost === null || unitCost < 0) {
    errors.unit_cost = "Enter a unit cost of 0 or more.";
  }
  if (discount === null || discount < 0) {
    errors.discount = "Enter a discount of 0 or more.";
  } else if (unitCost !== null && discount > quantity * unitCost) {
    errors.discount = "The discount can't be more than the line subtotal.";
  }
  return errors;
}

export function PurchaseOrderLineDialog({
  title,
  submitLabel,
  initial,
  itemLocked = false,
  isPending = false,
  serverError,
  onSubmit,
  onClose,
}: PurchaseOrderLineDialogProps) {
  const [item, setItem] = useState<Item | null>(initial?.item ?? null);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unitCost, setUnitCost] = useState(toMoneyInput(initial?.unitCost));
  const [discount, setDiscount] = useState(toMoneyInput(initial?.discount ?? 0));
  const [clientErrors, setClientErrors] = useState<Partial<Record<LineField, string>>>({});
  const fieldErrors: Partial<Record<LineField, string>> = { ...getFieldErrors(serverError), ...clientErrors };
  const parsedCost = parseMoney(unitCost);
  const parsedDiscount = parseMoney(discount);
  const previewTotal = parsedCost === null ? null : lineTotal(quantity, parsedCost, parsedDiscount ?? 0);

  function handleSubmit() {
    const errors = validate(item, quantity, parsedCost, parsedDiscount);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !item || parsedCost === null || parsedDiscount === null) {
      return;
    }
    return onSubmit({ item, quantity, unitCost: parsedCost, discount: parsedDiscount });
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !isPending && onClose()}
      title={title}
      footer={
        <>
          <Button variant="outline" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="po-line-form" isPending={isPending} pendingText="Saving…">
            {submitLabel}
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="po-line-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(serverError, LINE_FIELDS)} />
        <FormField label="Item" htmlFor="po-line-item" required error={fieldErrors.item_id}>
          {itemLocked && item ? (
            <p className="py-1.5 text-sm font-medium text-foreground md:text-ui">
              {item.name} <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
            </p>
          ) : (
            <ItemCombobox
              id="po-line-item"
              value={item}
              invalid={Boolean(fieldErrors.item_id)}
              onChange={(next) => {
                setItem(next);
                setClientErrors((current) => ({ ...current, item_id: undefined }));
              }}
            />
          )}
        </FormField>
        <FormField label="Unit" htmlFor="po-line-unit">
          <p id="po-line-unit" className="py-1.5 text-sm text-muted-foreground md:text-ui">
            {item?.unit?.name ?? "—"}
          </p>
        </FormField>
        <FormField label="Quantity" htmlFor="po-line-quantity" required error={fieldErrors.quantity_ordered}>
          <QuantityInput id="po-line-quantity" label="Quantity" min={1} value={quantity} onChange={setQuantity} />
        </FormField>
        <FormField label="Unit Cost (₱)" htmlFor="po-line-unit-cost" required error={fieldErrors.unit_cost}>
          <Input
            {...fieldA11yProps("po-line-unit-cost", fieldErrors.unit_cost)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="font-mono md:w-40"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </FormField>
        <FormField
          label="Discount (₱)"
          htmlFor="po-line-discount"
          hint="Amount taken off this line's subtotal."
          error={fieldErrors.discount}
        >
          <Input
            {...fieldA11yProps("po-line-discount", fieldErrors.discount)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="font-mono md:w-40"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </FormField>
        <FormField label="Line Total" htmlFor="po-line-total">
          <p id="po-line-total" className="py-1.5 font-mono text-sm font-semibold text-foreground md:text-ui">
            {formatMoney(previewTotal)}
          </p>
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
