import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, ShoppingCart } from "lucide-react";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { MicroLabel } from "@/components/MicroLabel";
import { QuantityInput } from "@/components/QuantityInput";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { SupplierCombobox } from "@/components/suppliers/SupplierCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePurchaseOrderMutation, usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import { toast } from "@/stores/toast.store";
import type { Item } from "@/types/inventory";
import type { Supplier } from "@/types/supplier";
import type { InsufficientStock } from "@/types/transfer";

interface ShortageDialogProps {
  shortage: InsufficientStock;
  item: Item | null;
  transferNumber: string;
  fulfillingBranchId: number;
  onClose: () => void;
}

export function ShortageDialog({ shortage, item, transferNumber, fulfillingBranchId, onClose }: ShortageDialogProps) {
  const navigate = useNavigate();
  const [creatingPo, setCreatingPo] = useState(false);
  const draftQuery = usePurchaseOrdersQuery({
    status: "draft",
    item_id: shortage.item_id,
    branch_id: fulfillingBranchId,
    per_page: 1,
  });
  const draft = draftQuery.data?.data[0];
  const missing = Math.max(1, shortage.requested - shortage.available);
  const unit = item?.unit?.code;

  if (creatingPo && item) {
    return (
      <ShortagePurchaseOrderDialog
        item={item}
        quantity={missing}
        transferNumber={transferNumber}
        branchId={fulfillingBranchId}
        onClose={onClose}
      />
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Insufficient Stock"
      description={
        <>
          Picking for <span className="font-mono">{transferNumber}</span> can't start until every line can be reserved.{" "}
          <span className="font-semibold text-foreground">{item?.name ?? `Item #${shortage.item_id}`}</span> is short.
          {draft && (
            <>
              {" "}
              MCVSync added it to draft <span className="font-mono">{draft.po_number}</span> for review.
            </>
          )}
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {draft ? (
            <Button
              onClick={() =>
                void navigate({
                  to: "/purchasing/purchase-orders/$purchaseOrderId",
                  params: { purchaseOrderId: String(draft.id) },
                })
              }
            >
              <FileText />
              Open Draft PO
            </Button>
          ) : (
            item && (
              <Button disabled={draftQuery.isPending} onClick={() => setCreatingPo(true)}>
                <ShoppingCart />
                Create Supplier PO
              </Button>
            )
          )}
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-2 border border-border-subtle bg-subtle px-3 py-2.5">
        {[
          { label: "Requested", value: shortage.requested, className: "text-foreground" },
          { label: "Available", value: shortage.available, className: "text-success" },
          { label: "Shortage", value: missing, className: "text-danger" },
        ].map((stat) => (
          <div key={stat.label} className="grid gap-0.5">
            <dt>
              <MicroLabel>{stat.label}</MicroLabel>
            </dt>
            <dd className={`font-mono text-base font-bold ${stat.className}`}>{formatQuantity(stat.value, unit)}</dd>
          </div>
        ))}
      </dl>
    </ResponsiveDialog>
  );
}

interface ShortagePurchaseOrderDialogProps {
  item: Item;
  quantity: number;
  transferNumber: string;
  branchId: number;
  onClose: () => void;
}

const PO_FIELDS = ["supplier_id", "branch_id", "remarks", "items", "items.0.quantity_ordered", "items.0.unit_cost", "items.0.item_id"];

function ShortagePurchaseOrderDialog({ item, quantity: initialQuantity, transferNumber, branchId, onClose }: ShortagePurchaseOrderDialogProps) {
  const navigate = useNavigate();
  const mutation = useCreatePurchaseOrderMutation();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState(`Restock for ${transferNumber}.`);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const fieldErrors: Record<string, string> = { ...getFieldErrors(mutation.error), ...clientErrors };

  function handleSubmit() {
    const cost = Number(unitCost);
    const errors: Record<string, string> = {};
    if (!supplier) {
      errors.supplier_id = "Choose a supplier.";
    }
    if (unitCost.trim() === "" || !Number.isFinite(cost) || cost < 0) {
      errors["items.0.unit_cost"] = "Enter a unit cost of 0 or more.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !supplier) {
      return;
    }
    return mutation.mutateAsync(
      {
        supplier_id: supplier.id,
        branch_id: branchId,
        request_delivery_date: null,
        terms: null,
        remarks: notes.trim() || null,
        items: [{ item_id: item.id, quantity_ordered: quantity, unit_cost: cost, discount: 0 }],
      },
      {
        onSuccess: (purchaseOrder) => {
          toast.success(`${purchaseOrder.po_number} created for ${supplier.name}.`, {
            action: {
              label: "View",
              onAction: () =>
                void navigate({
                  to: "/purchasing/purchase-orders/$purchaseOrderId",
                  params: { purchaseOrderId: String(purchaseOrder.id) },
                }),
            },
          });
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Create Supplier PO"
      description={
        <>
          A Purchase Order for <span className="font-semibold text-foreground">{item.name}</span> to cover the shortage.
        </>
      }
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="shortage-po-form" isPending={mutation.isPending} pendingText="Creating…">
            Create Purchase Order
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="shortage-po-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, PO_FIELDS)} />
        <FormField label="Supplier" htmlFor="shortage-supplier" required error={fieldErrors.supplier_id}>
          <SupplierCombobox id="shortage-supplier" value={supplier} invalid={Boolean(fieldErrors.supplier_id)} onChange={setSupplier} />
        </FormField>
        <FormField label="Quantity" htmlFor="shortage-quantity" required error={fieldErrors["items.0.quantity_ordered"]}>
          <QuantityInput id="shortage-quantity" label="Quantity" min={1} value={quantity} onChange={setQuantity} />
        </FormField>
        <FormField label="Unit Cost (₱)" htmlFor="shortage-unit-cost" required error={fieldErrors["items.0.unit_cost"]}>
          <Input
            {...fieldA11yProps("shortage-unit-cost", fieldErrors["items.0.unit_cost"])}
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
        <FormField label="Notes" htmlFor="shortage-notes" error={fieldErrors.remarks}>
          <Textarea
            {...fieldA11yProps("shortage-notes", fieldErrors.remarks)}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          {formatQuantity(quantity, item.unit?.code)} of {item.name}. Saved as an open Purchase Order for the fulfilling branch.
        </p>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
