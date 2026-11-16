import { useRef, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailHeader } from "@/components/DetailHeader";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectField } from "@/components/SelectField";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SubmitForm } from "@/components/SubmitForm";
import { TransferLineDialog, type TransferLineDraft } from "@/components/transfers/TransferLineDialog";
import { canRequestTransfer } from "@/components/transfers/transferRules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMeQuery } from "@/hooks/useAuth";
import { useBranchesQuery } from "@/hooks/useStaff";
import { useCreateTransferMutation } from "@/hooks/useTransfers";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatQuantity } from "@/lib/format";
import { INVENTORY_ACCESS_ROLES, requireRole, seesAllBranches } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";

export const Route = createFileRoute("/_authenticated/purchasing/transfers/new")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: NewTransferPage,
});

interface DraftLine {
  key: number;
  line: TransferLineDraft;
}

type LineDialogState = { mode: "add" } | { mode: "edit"; key: number } | null;

const BASE_FIELDS = ["requesting_branch_id", "remarks", "items"];

function NewTransferPage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const chooseBranch = user ? seesAllBranches(user) : false;
  const branchesQuery = useBranchesQuery(chooseBranch);
  const createMutation = useCreateTransferMutation();
  const [branchId, setBranchId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineDialog, setLineDialog] = useState<LineDialogState>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const nextKey = useRef(1);

  if (user && !canRequestTransfer(user)) {
    return <Navigate to="/purchasing/transfers" replace />;
  }

  const serverErrors = getFieldErrors(createMutation.error);
  const fieldErrors: Record<string, string> = { ...serverErrors, ...clientErrors };
  const renderedFields = [...BASE_FIELDS, ...Object.keys(serverErrors).filter((field) => field.startsWith("items."))];
  const editingLine = lineDialog?.mode === "edit" ? lines.find((entry) => entry.key === lineDialog.key) : undefined;
  const takenItemIds = new Set(lines.map(({ line }) => line.item.id));

  function saveLine(line: TransferLineDraft) {
    if (lineDialog?.mode === "edit") {
      setLines((current) => current.map((entry) => (entry.key === lineDialog.key ? { ...entry, line } : entry)));
    } else {
      setLines((current) => [...current, { key: nextKey.current++, line }]);
      setClientErrors(({ items: _removed, ...rest }) => rest);
    }
    createMutation.reset();
    setLineDialog(null);
  }

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (chooseBranch && !branchId) {
      errors.requesting_branch_id = "Choose the branch that needs the stock.";
    }
    if (lines.length === 0) {
      errors.items = "Add at least one item.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    return createMutation.mutateAsync(
      {
        requesting_branch_id: chooseBranch ? Number(branchId) : null,
        remarks: remarks.trim() || null,
        items: lines.map(({ line }) => ({ item_id: line.item.id, quantity: line.quantity })),
      },
      {
        onSuccess: (transfer) => {
          toast.success(`${transfer.transfer_number} sent to ${transfer.fulfilling_branch.name}.`);
          void navigate({
            to: "/purchasing/transfers/$transferId",
            params: { transferId: String(transfer.id) },
            replace: true,
          });
        },
      },
    );
  }

  const columns: DataListColumn<DraftLine & { index: number }>[] = [
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: ({ line, index }) => {
        const errorKey = Object.keys(serverErrors).find((field) => field.startsWith(`items.${index}.`));
        return (
          <span className="flex flex-col">
            <span className="font-medium">{line.item.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
            {errorKey && <span className="text-xs text-danger">{serverErrors[errorKey]}</span>}
          </span>
        );
      },
    },
    { key: "unit", header: "Unit", cell: ({ line }) => line.item.unit?.code ?? "—" },
    {
      key: "quantity",
      header: "Qty Needed",
      align: "right",
      mobile: "badge",
      cell: ({ line }) => <span className="font-mono">{formatQuantity(line.quantity, line.item.unit?.code)}</span>,
    },
  ];

  const addItemButton = (
    <Button type="button" variant="outline" size="sm" onClick={() => setLineDialog({ mode: "add" })}>
      <Plus />
      Add Item
    </Button>
  );

  const submitButton = (
    <LoadingButton type="submit" form="new-transfer-form" isPending={createMutation.isPending} pendingText="Submitting…">
      Submit Request
    </LoadingButton>
  );

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader backTo="/purchasing/transfers" backLabel="Transfer Orders" eyebrow="Transfer Order" title="New Transfer Request" />

      <SubmitForm id="new-transfer-form" onSubmit={handleSubmit} className="border border-border bg-card px-4 pb-5 md:px-6">
        <FormError message={getGeneralError(createMutation.error, renderedFields)} />

        <SectionTitle>Branch Details</SectionTitle>
        <div className="flex flex-col gap-4 md:gap-3.5">
          <FormField label="Requesting Branch" htmlFor="transfer-branch" required error={fieldErrors.requesting_branch_id}>
            {chooseBranch ? (
              <SelectField
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setClientErrors(({ requesting_branch_id: _removed, ...rest }) => rest);
                }}
                placeholder="Choose a branch"
                triggerProps={{ id: "transfer-branch", className: "w-full md:w-56", "aria-label": "Requesting branch" }}
                options={(branchesQuery.data ?? [])
                  .filter((branch) => !branch.is_main)
                  .map((branch) => ({ value: String(branch.id), label: branch.name }))}
              />
            ) : (
              <p className="py-1.5 text-sm md:text-ui">{user?.branch?.name ?? "—"}</p>
            )}
          </FormField>
          <FormField label="Fulfilling Branch" htmlFor="transfer-fulfilling">
            <p className="py-1.5 text-sm text-muted-foreground md:text-ui">The main branch</p>
          </FormField>
          <FormField label="Notes" htmlFor="transfer-remarks" error={fieldErrors.remarks}>
            <Textarea
              {...fieldA11yProps("transfer-remarks", fieldErrors.remarks)}
              rows={2}
              placeholder="Anything the main branch should know"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </FormField>
        </div>

        <SectionTitle actions={lines.length > 0 && addItemButton}>Items</SectionTitle>
        {fieldErrors.items && <FormError message={fieldErrors.items} />}
        <DataList
          label="Transfer request lines"
          columns={columns}
          rows={lines.map((entry, index) => ({ ...entry, index }))}
          rowKey={(entry) => entry.key}
          isPending={false}
          onRetry={() => undefined}
          empty={{ title: "No items yet", description: "Add the items this branch needs from the main branch.", action: addItemButton }}
          rowActions={(entry) => [
            { label: "Edit", icon: Pencil, onClick: () => setLineDialog({ mode: "edit", key: entry.key }) },
            {
              label: "Remove",
              icon: Trash2,
              destructive: true,
              onClick: () => setLines((current) => current.filter((candidate) => candidate.key !== entry.key)),
            },
          ]}
        />

        <div className="mt-6 hidden justify-end border-t border-border-subtle pt-4 md:flex">{submitButton}</div>
        <StickyActionBar>{submitButton}</StickyActionBar>
      </SubmitForm>

      {lineDialog && (
        <TransferLineDialog
          key={lineDialog.mode === "edit" ? `edit-${lineDialog.key}` : "add"}
          title={lineDialog.mode === "edit" ? "Edit Item" : "Add Item"}
          submitLabel={lineDialog.mode === "edit" ? "Save Item" : "Add Item"}
          initial={editingLine?.line}
          takenItemIds={takenItemIds}
          onSubmit={saveLine}
          onClose={() => setLineDialog(null)}
        />
      )}
    </div>
  );
}
