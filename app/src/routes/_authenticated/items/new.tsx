import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DetailHeader } from "@/components/DetailHeader";
import { ItemForm } from "@/components/inventory/ItemForm";
import { useCreateItemMutation } from "@/hooks/useInventory";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";

export const Route = createFileRoute("/_authenticated/items/new")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: ItemCreatePage,
});

function ItemCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateItemMutation();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <DetailHeader backTo="/items" backLabel="Items" eyebrow="Inventory Item" title="Add Item" />
      </div>

      <ItemForm
        isPending={createMutation.isPending}
        submitError={createMutation.error}
        onSubmit={(payload) =>
          createMutation.mutate(payload, {
            onSuccess: (item) => {
              toast.success(`${item.name} added.`);
              void navigate({ to: "/items/$itemId", params: { itemId: String(item.id) } });
            },
          })
        }
      />
    </div>
  );
}
