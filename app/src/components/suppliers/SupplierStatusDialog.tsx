import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSetSupplierActiveMutation } from "@/hooks/useSuppliers";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { Supplier } from "@/types/supplier";

interface SupplierStatusDialogProps {
  supplier: Supplier | null;
  onClose: () => void;
}

export function SupplierStatusDialog({ supplier, onClose }: SupplierStatusDialogProps) {
  const mutation = useSetSupplierActiveMutation();
  const deactivating = supplier?.is_active ?? true;

  function confirm() {
    if (!supplier) {
      return;
    }
    return mutation.mutateAsync(
      { id: supplier.id, active: !supplier.is_active },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.name} ${saved.is_active ? "activated" : "deactivated"}.`);
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open={supplier !== null}
      onOpenChange={(open) => {
        if (!open) {
          mutation.reset();
          onClose();
        }
      }}
      title={deactivating ? "Deactivate Supplier?" : "Activate Supplier?"}
      description={
        deactivating ? (
          <>
            <span className="font-semibold">{supplier?.name}</span> won't be selectable on new Purchase Orders.
            Existing Purchase Orders keep showing it. You can activate it again at any time.
          </>
        ) : (
          <>
            <span className="font-semibold">{supplier?.name}</span> will be selectable on new Purchase Orders again.
          </>
        )
      }
      confirmLabel={deactivating ? "Deactivate Supplier" : "Activate Supplier"}
      destructive={deactivating}
      isPending={mutation.isPending}
      error={mutation.isError ? getErrorMessage(mutation.error) : null}
      onConfirm={confirm}
    />
  );
}
