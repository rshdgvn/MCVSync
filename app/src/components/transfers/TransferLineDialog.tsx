import { useState } from "react";
import { FormField } from "@/components/FormField";
import { ItemCombobox } from "@/components/inventory/ItemCombobox";
import { LoadingButton } from "@/components/LoadingButton";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import type { Item } from "@/types/inventory";

export interface TransferLineDraft {
  item: Item;
  quantity: number;
}

interface TransferLineDialogProps {
  title: string;
  submitLabel: string;
  initial?: TransferLineDraft;
  takenItemIds: ReadonlySet<number>;
  onSubmit: (line: TransferLineDraft) => void;
  onClose: () => void;
}

export function TransferLineDialog({ title, submitLabel, initial, takenItemIds, onSubmit, onClose }: TransferLineDialogProps) {
  const [item, setItem] = useState<Item | null>(initial?.item ?? null);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [itemError, setItemError] = useState<string | null>(null);

  function handleSubmit() {
    if (!item) {
      setItemError("Choose an item.");
      return;
    }
    if (item.id !== initial?.item.id && takenItemIds.has(item.id)) {
      setItemError("This item is already on the request. Edit its quantity instead.");
      return;
    }
    onSubmit({ item, quantity });
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="transfer-line-form">
            {submitLabel}
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="transfer-line-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField label="Item" htmlFor="transfer-line-item" required error={itemError ?? undefined}>
          <ItemCombobox
            id="transfer-line-item"
            value={item}
            invalid={Boolean(itemError)}
            onChange={(next) => {
              setItem(next);
              setItemError(null);
            }}
          />
        </FormField>
        <FormField label="Unit" htmlFor="transfer-line-unit">
          <p id="transfer-line-unit" className="py-1.5 text-sm text-muted-foreground md:text-ui">
            {item?.unit?.name ?? "—"}
          </p>
        </FormField>
        <FormField label="Qty Needed" htmlFor="transfer-line-quantity" required>
          <QuantityInput id="transfer-line-quantity" label="Quantity needed" min={1} value={quantity} onChange={setQuantity} />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
