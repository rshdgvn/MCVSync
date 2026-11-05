import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailHeader } from "@/components/DetailHeader";
import { FormError } from "@/components/FormError";
import { FormField } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import {
  HEADER_FIELDS,
  PurchaseOrderHeaderFields,
  toHeaderPayload,
  toHeaderValues,
} from "@/components/purchase-orders/PurchaseOrderHeaderFields";
import {
  PurchaseOrderLineDialog,
  type PurchaseOrderLineDraft,
} from "@/components/purchase-orders/PurchaseOrderLineDialog";
import { lineTotal } from "@/components/purchase-orders/purchaseOrderRules";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectField } from "@/components/SelectField";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SubmitForm } from "@/components/SubmitForm";
import { SupplierCombobox } from "@/components/suppliers/SupplierCombobox";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { itemQueryOptions } from "@/hooks/useInventory";
import { useCreatePurchaseOrderMutation } from "@/hooks/usePurchaseOrders";
import { useBranchesQuery } from "@/hooks/useStaff";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatDate, formatMoney, formatQuantity, toIsoDate } from "@/lib/format";
import { requireRole, seesAllBranches } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Supplier } from "@/types/supplier";

interface NewPurchaseOrderSearch {
  item_id?: number;
  qty?: number;
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const Route = createFileRoute("/_authenticated/purchasing/purchase-orders/new")({
  beforeLoad: requireRole("purchasing"),
  validateSearch: (search: Record<string, unknown>): NewPurchaseOrderSearch => ({
    item_id: positiveInteger(search.item_id),
    qty: positiveInteger(search.qty),
  }),
  component: NewPurchaseOrderPage,
});

interface DraftLine {
  key: number;
  line: PurchaseOrderLineDraft;
}

type LineDialogState = { mode: "add"; initial?: Partial<PurchaseOrderLineDraft> } | { mode: "edit"; key: number } | null;

const BASE_FIELDS = [...HEADER_FIELDS, "supplier_id", "branch_id", "items"];

function lineErrorAt(fieldErrors: Record<string, string>, index: number): string | undefined {
  const prefix = `items.${index}.`;
  const key = Object.keys(fieldErrors).find((field) => field.startsWith(prefix));
  return key ? fieldErrors[key] : undefined;
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <p className="py-1.5 text-sm text-foreground md:text-ui">{children}</p>;
}

function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const user = useMeQuery().data;
  const chooseBranch = user ? seesAllBranches(user) : false;
  const branchesQuery = useBranchesQuery(chooseBranch);
  const createMutation = useCreatePurchaseOrderMutation();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [branchId, setBranchId] = useState(user?.branch ? String(user.branch.id) : "");
  const [headerValues, setHeaderValues] = useState(() => toHeaderValues());
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineDialog, setLineDialog] = useState<LineDialogState>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const nextKey = useRef(1);
  const prefillHandled = useRef(false);

  const prefillQuery = useQuery({ ...itemQueryOptions(search.item_id ?? 0), enabled: search.item_id !== undefined });
  const prefillItem = prefillQuery.data;
  const prefillError =
    prefillQuery.isError || (prefillItem && !prefillItem.is_active)
      ? "The suggested item can't be ordered because it is inactive or no longer exists."
      : null;

  useEffect(() => {
    if (prefillHandled.current || !prefillItem || !prefillItem.is_active) {
      return;
    }
    prefillHandled.current = true;
    setLineDialog({ mode: "add", initial: { item: prefillItem, quantity: search.qty ?? 1 } });
  }, [prefillItem, search.qty]);

  const serverErrors = getFieldErrors(createMutation.error);
  const fieldErrors: Record<string, string> = { ...serverErrors, ...clientErrors };
  const renderedFields = [...BASE_FIELDS, ...Object.keys(serverErrors).filter((field) => field.startsWith("items."))];
  const estimatedTotal = lines.reduce(
    (sum, { line }) => sum + lineTotal(line.quantity, line.unitCost, line.discount),
    0,
  );
  const editingLine = lineDialog?.mode === "edit" ? lines.find((entry) => entry.key === lineDialog.key) : undefined;

  function saveLine(line: PurchaseOrderLineDraft) {
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
    if (!supplier) {
      errors.supplier_id = "Choose a supplier.";
    }
    if (!branchId) {
      errors.branch_id = "Choose the branch this order restocks.";
    }
    if (lines.length === 0) {
      errors.items = "Add at least one item.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !supplier) {
      return;
    }
    return createMutation.mutateAsync(
      {
        supplier_id: supplier.id,
        branch_id: Number(branchId),
        ...toHeaderPayload(headerValues),
        items: lines.map(({ line }) => ({
          item_id: line.item.id,
          quantity_ordered: line.quantity,
          unit_cost: line.unitCost,
          discount: line.discount,
        })),
      },
      {
        onSuccess: (purchaseOrder) => {
          toast.success(`${purchaseOrder.po_number} created.`);
          void navigate({
            to: "/purchasing/purchase-orders/$purchaseOrderId",
            params: { purchaseOrderId: String(purchaseOrder.id) },
            replace: true,
          });
        },
      },
    );
  }

  const lineColumns: DataListColumn<DraftLine & { index: number }>[] = [
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: ({ line, index }) => {
        const error = lineErrorAt(serverErrors, index);
        return (
          <span className="flex flex-col">
            <span className="font-medium">{line.item.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
            {error && <span className="text-xs text-danger">{error}</span>}
          </span>
        );
      },
    },
    {
      key: "quantity",
      header: "Qty",
      align: "right",
      cell: ({ line }) => <span className="font-mono">{formatQuantity(line.quantity, line.item.unit?.code)}</span>,
    },
    {
      key: "unit_cost",
      header: "Unit Cost",
      align: "right",
      cell: ({ line }) => <span className="font-mono">{formatMoney(line.unitCost)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      cell: ({ line }) => <span className="font-mono">{formatMoney(line.discount)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      mobile: "badge",
      cell: ({ line }) => (
        <span className="font-mono font-semibold">{formatMoney(lineTotal(line.quantity, line.unitCost, line.discount))}</span>
      ),
    },
  ];

  const addItemButton = (
    <Button type="button" variant="outline" size="sm" onClick={() => setLineDialog({ mode: "add" })}>
      <Plus />
      Add Item
    </Button>
  );

  const submitButton = (
    <LoadingButton type="submit" form="new-po-form" isPending={createMutation.isPending} pendingText="Creating…">
      Create Purchase Order
    </LoadingButton>
  );

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/purchasing/purchase-orders"
        backLabel="Purchase Orders"
        eyebrow="Purchase Order"
        title="New Purchase Order"
      />

      <SubmitForm id="new-po-form" onSubmit={handleSubmit} className="border border-border bg-card px-4 pb-5 md:px-6">
        <FormError message={prefillError ?? getGeneralError(createMutation.error, renderedFields)} />

        <SectionTitle>Supplier Details</SectionTitle>
        <div className="flex flex-col gap-4 md:gap-3.5">
          <FormField label="Supplier" htmlFor="po-supplier" required error={fieldErrors.supplier_id}>
            <SupplierCombobox
              id="po-supplier"
              value={supplier}
              invalid={Boolean(fieldErrors.supplier_id)}
              onChange={(next) => {
                setSupplier(next);
                setClientErrors(({ supplier_id: _removed, ...rest }) => rest);
              }}
            />
          </FormField>
          {supplier && (
            <>
              <FormField label="Contact #" htmlFor="po-supplier-phone">
                <ReadOnlyValue>{supplier.phone ?? "—"}</ReadOnlyValue>
              </FormField>
              <FormField label="Address" htmlFor="po-supplier-address">
                <ReadOnlyValue>{supplier.address ?? "—"}</ReadOnlyValue>
              </FormField>
            </>
          )}
        </div>

        <SectionTitle>Information</SectionTitle>
        <div className="flex flex-col gap-4 md:gap-3.5">
          <FormField label="PO #" htmlFor="po-number">
            <ReadOnlyValue>
              <span className="text-muted-foreground">Assigned when saved</span>
            </ReadOnlyValue>
          </FormField>
          <FormField label="Date" htmlFor="po-order-date">
            <ReadOnlyValue>{formatDate(new Date())}</ReadOnlyValue>
          </FormField>
          <FormField label="Branch" htmlFor="po-branch" required error={fieldErrors.branch_id}>
            {chooseBranch ? (
              <SelectField
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setClientErrors(({ branch_id: _removed, ...rest }) => rest);
                }}
                placeholder="Choose a branch"
                triggerProps={{ id: "po-branch", className: "w-full md:w-56", "aria-label": "Branch" }}
                options={(branchesQuery.data ?? []).map((branch) => ({ value: String(branch.id), label: branch.name }))}
              />
            ) : (
              <ReadOnlyValue>{user?.branch?.name ?? "—"}</ReadOnlyValue>
            )}
          </FormField>
          <PurchaseOrderHeaderFields
            values={headerValues}
            onChange={setHeaderValues}
            fieldErrors={fieldErrors}
            minDeliveryDate={toIsoDate(new Date())}
          />
          <FormField label="Prepared By" htmlFor="po-prepared-by">
            <ReadOnlyValue>{user?.name ?? "—"}</ReadOnlyValue>
          </FormField>
        </div>

        <SectionTitle actions={lines.length > 0 && addItemButton}>Item Table</SectionTitle>
        {fieldErrors.items && <FormError message={fieldErrors.items} />}
        <DataList
          label="Purchase order lines"
          columns={lineColumns}
          rows={lines.map((entry, index) => ({ ...entry, index }))}
          rowKey={(entry) => entry.key}
          isPending={false}
          onRetry={() => undefined}
          empty={{ title: "No items yet", description: "Add the items you're ordering from this supplier.", action: addItemButton }}
          rowActions={(entry) => [
            { label: "Edit", icon: Pencil, onClick: () => setLineDialog({ mode: "edit", key: entry.key }) },
            {
              label: "Remove",
              icon: Trash2,
              destructive: true,
              onClick: () => setLines((current) => current.filter((candidate) => candidate.key !== entry.key)),
            },
          ]}
          footer={
            lines.length > 0 && (
              <div className="flex items-baseline justify-end gap-3 px-4 py-3">
                <span className="text-sm font-semibold md:text-ui">Estimated Total</span>
                <span className="font-mono text-base font-bold">{formatMoney(estimatedTotal)}</span>
              </div>
            )
          }
        />
        <p className="mt-2 text-xs text-muted-foreground">The final total is calculated by the server when you save.</p>

        <div className="mt-6 hidden justify-end border-t border-border-subtle pt-4 md:flex">{submitButton}</div>
        <StickyActionBar>{submitButton}</StickyActionBar>
      </SubmitForm>

      {lineDialog && (
        <PurchaseOrderLineDialog
          key={lineDialog.mode === "edit" ? `edit-${lineDialog.key}` : "add"}
          title={lineDialog.mode === "edit" ? "Edit Item" : "Add Item"}
          submitLabel={lineDialog.mode === "edit" ? "Save Item" : "Add Item"}
          initial={lineDialog.mode === "edit" ? editingLine?.line : lineDialog.initial}
          onSubmit={saveLine}
          onClose={() => setLineDialog(null)}
        />
      )}
    </div>
  );
}
