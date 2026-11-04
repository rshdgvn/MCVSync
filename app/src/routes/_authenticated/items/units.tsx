import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateUnitMutation,
  useDeleteUnitMutation,
  useUnitsQuery,
  useUpdateUnitMutation,
} from "@/hooks/useInventory";
import { getErrorMessage, getFieldErrors, getGeneralError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Unit } from "@/types/inventory";

export const Route = createFileRoute("/_authenticated/items/units")({
  beforeLoad: requireRole("purchasing", "admin", "super_admin"),
  component: UnitsPage,
});

type DialogState = { mode: "create" } | { mode: "edit"; unit: Unit } | null;

const COLUMNS: DataListColumn<Unit>[] = [
  { key: "name", header: "Unit Name", mobile: "title", cell: (unit) => unit.name },
  {
    key: "code",
    header: "Code",
    mobile: "subtitle",
    cell: (unit) => <span className="font-mono text-xs">{unit.code}</span>,
  },
];

function UnitsPage() {
  const unitsQuery = useUnitsQuery();
  const deleteMutation = useDeleteUnitMutation();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);

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
        title="Units of Measure"
        description="How items are counted, like pieces, boxes, or kilograms. A unit in use by items can't be deleted."
        primaryAction={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            Add Unit
          </Button>
        }
      />

      <DataList
        label="Units of measure"
        columns={COLUMNS}
        rows={unitsQuery.data}
        rowKey={(unit) => unit.id}
        isPending={unitsQuery.isPending}
        error={unitsQuery.error}
        onRetry={() => void unitsQuery.refetch()}
        skeletonRows={5}
        empty={{
          title: "No units yet",
          description: "Add the first unit so items can be counted.",
          action: (
            <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
              <Plus />
              Add Unit
            </Button>
          ),
        }}
        rowActions={(unit) => [
          { label: "Edit", icon: Pencil, onClick: () => setDialog({ mode: "edit", unit }) },
          {
            label: "Delete",
            icon: Trash2,
            destructive: true,
            onClick: () => {
              deleteMutation.reset();
              setDeleting(unit);
            },
          },
        ]}
      />

      {dialog && (
        <UnitDialog
          key={dialog.mode === "edit" ? dialog.unit.id : "create"}
          unit={dialog.mode === "edit" ? dialog.unit : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete Unit?"
        description={
          <>
            <span className="font-semibold">{deleting?.name}</span> will be removed. This can't be undone.
          </>
        }
        confirmLabel="Delete Unit"
        destructive
        isPending={deleteMutation.isPending}
        error={deleteMutation.isError ? getErrorMessage(deleteMutation.error) : null}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

interface UnitDialogProps {
  unit?: Unit;
  onClose: () => void;
}

function UnitDialog({ unit, onClose }: UnitDialogProps) {
  const createMutation = useCreateUnitMutation();
  const updateMutation = useUpdateUnitMutation();
  const [code, setCode] = useState(unit?.code ?? "");
  const [name, setName] = useState(unit?.name ?? "");
  const mutation = unit ? updateMutation : createMutation;
  const fieldErrors = getFieldErrors(mutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = { code, name };
    const onSuccess = () => {
      toast.success(unit ? "Unit updated." : `${name} added.`);
      onClose();
    };
    if (unit) {
      updateMutation.mutate({ id: unit.id, payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title={unit ? "Edit Unit" : "Add Unit"}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="unit-form" isPending={mutation.isPending} pendingText="Saving…">
            {unit ? "Save Changes" : "Add Unit"}
          </LoadingButton>
        </>
      }
    >
      <form id="unit-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error)} />
        <FormField label="Name" htmlFor="unit-name" required error={fieldErrors.name}>
          <Input
            {...fieldA11yProps("unit-name", fieldErrors.name)}
            autoFocus
            required
            placeholder="e.g. Pieces"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Code" htmlFor="unit-code" required hint="Short form shown in tables, like pcs or kg." error={fieldErrors.code}>
          <Input
            {...fieldA11yProps("unit-code", fieldErrors.code, true)}
            required
            className="font-mono md:w-32"
            placeholder="pcs"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
