import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormError } from "@/components/FormError";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from "@/hooks/useInventory";
import { getErrorMessage, getFieldErrors, getGeneralError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Category } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items/categories")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: CategoriesPage,
});

type DialogState = { mode: "create" } | { mode: "edit"; category: Category } | null;

const COLUMNS: DataListColumn<Category>[] = [
  { key: "name", header: "Category Name", mobile: "title", cell: (category) => category.name },
];

function CategoriesPage() {
  const categoriesQuery = useCategoriesQuery();
  const deleteMutation = useDeleteCategoryMutation();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  function confirmDelete() {
    if (!deleting) {
      return;
    }
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} deleted.`);
        setDeleting(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Categories"
        description="Group items in the catalog. A category in use by items can't be deleted."
        primaryAction={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            Add Category
          </Button>
        }
      />

      <DataList
        label="Categories"
        columns={COLUMNS}
        rows={categoriesQuery.data}
        rowKey={(category) => category.id}
        isPending={categoriesQuery.isPending}
        error={categoriesQuery.error}
        onRetry={() => void categoriesQuery.refetch()}
        skeletonRows={5}
        empty={{
          title: "No categories yet",
          description: "Add the first category to start organizing items.",
          action: (
            <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
              <Plus />
              Add Category
            </Button>
          ),
        }}
        rowActions={(category) => [
          { label: "Edit", icon: Pencil, onClick: () => setDialog({ mode: "edit", category }) },
          {
            label: "Delete",
            icon: Trash2,
            destructive: true,
            onClick: () => {
              deleteMutation.reset();
              setDeleting(category);
            },
          },
        ]}
      />

      {dialog && (
        <CategoryDialog
          key={dialog.mode === "edit" ? dialog.category.id : "create"}
          category={dialog.mode === "edit" ? dialog.category : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete Category?"
        description={
          <>
            <span className="font-semibold">{deleting?.name}</span> will be removed. This can't be undone.
          </>
        }
        confirmLabel="Delete Category"
        destructive
        isPending={deleteMutation.isPending}
        error={deleteMutation.isError ? getErrorMessage(deleteMutation.error) : null}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

interface CategoryDialogProps {
  category?: Category;
  onClose: () => void;
}

function CategoryDialog({ category, onClose }: CategoryDialogProps) {
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const [name, setName] = useState(category?.name ?? "");
  const mutation = category ? updateMutation : createMutation;
  const fieldErrors = getFieldErrors(mutation.error);
  const generalError = getGeneralError(mutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const onSuccess = () => {
      toast.success(category ? "Category updated." : `${name} added.`);
      onClose();
    };
    if (category) {
      updateMutation.mutate({ id: category.id, payload: { name } }, { onSuccess });
    } else {
      createMutation.mutate({ name }, { onSuccess });
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title={category ? "Edit Category" : "Add Category"}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="category-form" isPending={mutation.isPending} pendingText="Saving…">
            {category ? "Save Changes" : "Add Category"}
          </LoadingButton>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <FormError message={generalError} />
        <FormField label="Name" htmlFor="category-name" required error={fieldErrors.name}>
          <Input
            {...fieldA11yProps("category-name", fieldErrors.name)}
            autoFocus
            required
            placeholder="e.g. Consumables"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
