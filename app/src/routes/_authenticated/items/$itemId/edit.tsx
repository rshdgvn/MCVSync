import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DetailHeader } from "@/components/DetailHeader";
import { ErrorState } from "@/components/ErrorState";
import { ItemForm } from "@/components/inventory/ItemForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemQuery, useUpdateItemMutation } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";

export const Route = createFileRoute("/_authenticated/items/$itemId/edit")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemEditPage,
});

function ItemEditPage() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  const itemQuery = useItemQuery(Number(itemId));
  const updateMutation = useUpdateItemMutation();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <DetailHeader
          backTo="/items"
          backLabel="Items"
          eyebrow="Edit Item"
          title={itemQuery.data?.name ?? <Skeleton className="h-7 w-56" />}
        />
      </div>

      {itemQuery.isPending && (
        <div className="space-y-3 border border-border bg-card p-6" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {itemQuery.isError && (
        <div className="border border-border bg-card">
          <ErrorState
            title="This item couldn't be loaded"
            message={getErrorMessage(itemQuery.error)}
            onRetry={() => void itemQuery.refetch()}
          />
        </div>
      )}

      {itemQuery.data && (
        <ItemForm
          initialItem={itemQuery.data}
          isPending={updateMutation.isPending}
          submitError={updateMutation.error}
          onSubmit={(payload) =>
            updateMutation.mutate(
              { id: itemQuery.data.id, payload },
              {
                onSuccess: () => {
                  toast.success("Changes saved.");
                  void navigate({ to: "/items/$itemId", params: { itemId } });
                },
              },
            )
          }
        />
      )}
    </div>
  );
}
