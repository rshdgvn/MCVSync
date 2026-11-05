import { useState } from "react";
import { FormError } from "@/components/FormError";
import { LoadingButton } from "@/components/LoadingButton";
import {
  HEADER_FIELDS,
  PurchaseOrderHeaderFields,
  toHeaderPayload,
  toHeaderValues,
} from "@/components/purchase-orders/PurchaseOrderHeaderFields";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { useUpdatePurchaseOrderMutation } from "@/hooks/usePurchaseOrders";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { PurchaseOrderDetail } from "@/types/purchaseOrder";

interface PurchaseOrderHeaderDialogProps {
  purchaseOrder: PurchaseOrderDetail;
  onClose: () => void;
}

export function PurchaseOrderHeaderDialog({ purchaseOrder, onClose }: PurchaseOrderHeaderDialogProps) {
  const mutation = useUpdatePurchaseOrderMutation(purchaseOrder.id);
  const [values, setValues] = useState(() => toHeaderValues(purchaseOrder));

  function handleSubmit() {
    return mutation.mutateAsync(toHeaderPayload(values), {
      onSuccess: () => {
        toast.success("Purchase Order updated.");
        onClose();
      },
    });
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Edit Purchase Order"
      description={<span className="font-mono">{purchaseOrder.po_number}</span>}
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="po-header-form" isPending={mutation.isPending} pendingText="Saving…">
            Save Changes
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="po-header-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, HEADER_FIELDS)} />
        <PurchaseOrderHeaderFields
          values={values}
          onChange={setValues}
          fieldErrors={getFieldErrors(mutation.error)}
          minDeliveryDate={purchaseOrder.order_date}
        />
      </SubmitForm>
    </ResponsiveDialog>
  );
}
