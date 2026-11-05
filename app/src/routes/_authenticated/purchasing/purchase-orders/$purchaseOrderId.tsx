import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, PackageCheck, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DiscrepancyList } from "@/components/discrepancies/DiscrepancyList";
import { DetailCard, DetailField } from "@/components/DetailFields";
import { DetailHeader, type OverflowAction } from "@/components/DetailHeader";
import { DetailLoadError } from "@/components/DetailLoadError";
import { PurchaseOrderHeaderDialog } from "@/components/purchase-orders/PurchaseOrderHeaderDialog";
import {
  PurchaseOrderLineDialog,
  type PurchaseOrderLineDraft,
} from "@/components/purchase-orders/PurchaseOrderLineDialog";
import {
  canCancelPurchaseOrder,
  canEditPurchaseOrder,
  canMarkPurchaseOrderReady,
  canReceivePurchaseOrder,
} from "@/components/purchase-orders/purchaseOrderRules";
import { QuantityProgress } from "@/components/QuantityProgress";
import { SectionTitle } from "@/components/SectionTitle";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPLIER_ROUTES, supplierSectionFor } from "@/components/suppliers/supplierRoutes";
import { useEffectiveRole } from "@/hooks/useAuth";
import { useDiscrepanciesQuery } from "@/hooks/useDiscrepancies";
import {
  useAddPurchaseOrderLineMutation,
  useCancelPurchaseOrderMutation,
  useMarkPurchaseOrderReadyMutation,
  usePurchaseOrderQuery,
  useRemovePurchaseOrderLineMutation,
  useUpdatePurchaseOrderLineMutation,
} from "@/hooks/usePurchaseOrders";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { PURCHASE_ORDER_ROLES, requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { PurchaseOrderDetail, PurchaseOrderLine } from "@/types/purchaseOrder";

export const Route = createFileRoute("/_authenticated/purchasing/purchase-orders/$purchaseOrderId")({
  beforeLoad: requireRole(...PURCHASE_ORDER_ROLES),
  component: PurchaseOrderDetailRoute,
});

function PurchaseOrderDetailRoute() {
  const { purchaseOrderId } = Route.useParams();
  return <PurchaseOrderDetailPage key={purchaseOrderId} id={Number(purchaseOrderId)} />;
}

type LineDialogState = { mode: "add" } | { mode: "edit"; line: PurchaseOrderLine } | null;

type StatusAction = "mark-ready" | "cancel" | null;

function lineDraft(line: PurchaseOrderLine): PurchaseOrderLineDraft {
  return { item: line.item, quantity: line.quantity_ordered, unitCost: line.unit_cost, discount: line.discount };
}

function PurchaseOrderDetailPage({ id }: { id: number }) {
  const query = usePurchaseOrderQuery(id);

  if (query.isPending) {
    return <PurchaseOrderDetailSkeleton />;
  }

  if (query.isError) {
    return (
      <DetailLoadError
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/purchasing/purchase-orders"
        backLabel="Purchase Orders"
        entityLabel="Purchase Order"
      />
    );
  }

  return <PurchaseOrderDetailView purchaseOrder={query.data} />;
}

function PurchaseOrderDetailView({ purchaseOrder }: { purchaseOrder: PurchaseOrderDetail }) {
  const { id, status } = purchaseOrder;
  const addLineMutation = useAddPurchaseOrderLineMutation(id);
  const updateLineMutation = useUpdatePurchaseOrderLineMutation(id);
  const removeLineMutation = useRemovePurchaseOrderLineMutation(id);
  const markReadyMutation = useMarkPurchaseOrderReadyMutation(id);
  const cancelMutation = useCancelPurchaseOrderMutation(id);
  const [editingHeader, setEditingHeader] = useState(false);
  const [lineDialog, setLineDialog] = useState<LineDialogState>(null);
  const [removingLine, setRemovingLine] = useState<PurchaseOrderLine | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const editable = canEditPurchaseOrder(status);
  const isLastLine = purchaseOrder.items.length <= 1;
  const lineMutation = lineDialog?.mode === "edit" ? updateLineMutation : addLineMutation;
  const statusMutation = statusAction === "cancel" ? cancelMutation : markReadyMutation;
  const supplierSection = supplierSectionFor(useEffectiveRole());
  const [discrepancyPage, setDiscrepancyPage] = useState(1);
  const discrepanciesQuery = useDiscrepanciesQuery({ page: discrepancyPage, reference_type: "purchase_order", reference_id: id });

  function openLineDialog(state: LineDialogState) {
    addLineMutation.reset();
    updateLineMutation.reset();
    setLineDialog(state);
  }

  function saveLine(draft: PurchaseOrderLineDraft) {
    const payload = { quantity_ordered: draft.quantity, unit_cost: draft.unitCost, discount: draft.discount };
    const onSuccess = () => {
      toast.success(lineDialog?.mode === "edit" ? "Item updated." : `${draft.item.name} added.`);
      setLineDialog(null);
    };
    if (lineDialog?.mode === "edit") {
      return updateLineMutation.mutateAsync({ lineId: lineDialog.line.id, payload }, { onSuccess });
    }
    return addLineMutation.mutateAsync({ ...payload, item_id: draft.item.id }, { onSuccess });
  }

  function confirmRemoveLine() {
    if (!removingLine) {
      return;
    }
    return removeLineMutation.mutateAsync(removingLine.id, {
      onSuccess: () => {
        toast.success(`${removingLine.item.name} removed.`);
        setRemovingLine(null);
      },
    });
  }

  function confirmStatusAction() {
    return statusMutation.mutateAsync(undefined, {
      onSuccess: () => {
        toast.success(
          statusAction === "cancel"
            ? `${purchaseOrder.po_number} cancelled.`
            : `${purchaseOrder.po_number} is ready for delivery.`,
        );
        setStatusAction(null);
      },
    });
  }

  const overflowActions: OverflowAction[] = [];
  if (editable) {
    overflowActions.push({ label: "Edit Details", icon: Pencil, onSelect: () => setEditingHeader(true) });
  }
  if (canCancelPurchaseOrder(status)) {
    overflowActions.push({
      label: "Cancel Purchase Order",
      icon: Ban,
      destructive: true,
      onSelect: () => {
        cancelMutation.reset();
        setStatusAction("cancel");
      },
    });
  }

  const lineColumns: DataListColumn<PurchaseOrderLine>[] = [
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: (line) => (
        <span className="flex flex-col">
          <span className="font-medium">{line.item.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
        </span>
      ),
    },
    {
      key: "received",
      header: "Received / Ordered",
      className: "w-44",
      cell: (line) => <QuantityProgress value={line.quantity_received} total={line.quantity_ordered} />,
    },
    { key: "unit", header: "Unit", cell: (line) => line.item.unit?.code ?? "—" },
    {
      key: "unit_cost",
      header: "Unit Cost",
      align: "right",
      cell: (line) => <span className="font-mono">{formatMoney(line.unit_cost)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      cell: (line) => <span className="font-mono">{formatMoney(line.discount)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      mobile: "badge",
      cell: (line) => <span className="font-mono font-semibold">{formatMoney(line.total)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <DetailHeader
          backTo="/purchasing/purchase-orders"
          backLabel="Purchase Orders"
          eyebrow="Purchase Order"
          title={<span className="font-mono">{purchaseOrder.po_number}</span>}
          meta={
            <>
              <StatusBadge status={status} />
              <span>Ordered {formatDate(purchaseOrder.order_date)}</span>
              <span>{purchaseOrder.branch.name}</span>
            </>
          }
          overflowActions={overflowActions}
          primaryAction={
            canReceivePurchaseOrder(status) && (
              <>
                <Button
                  variant={canMarkPurchaseOrderReady(status) ? "outline" : "default"}
                  render={
                    <Link
                      to="/purchasing/stock-receiving/purchase-orders/$purchaseOrderId"
                      params={{ purchaseOrderId: String(id) }}
                    />
                  }
                >
                  <PackageCheck />
                  Receive Stock
                </Button>
                {canMarkPurchaseOrderReady(status) && (
                  <Button
                    onClick={() => {
                      markReadyMutation.reset();
                      setStatusAction("mark-ready");
                    }}
                  >
                    <Truck />
                    Mark Ready for Delivery
                  </Button>
                )}
              </>
            )
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Supplier Details">
          <DetailField label="Supplier">
            <span className="inline-flex flex-wrap items-center gap-2">
              {supplierSection ? (
                <Link
                  to={SUPPLIER_ROUTES[supplierSection].detail}
                  params={{ supplierId: String(purchaseOrder.supplier.id) }}
                  className="font-semibold text-primary hover:underline"
                >
                  {purchaseOrder.supplier.name}
                </Link>
              ) : (
                <span className="font-semibold">{purchaseOrder.supplier.name}</span>
              )}
              {!purchaseOrder.supplier.is_active && <StatusBadge status="inactive" />}
            </span>
          </DetailField>
          <DetailField label="Address">{purchaseOrder.supplier.address}</DetailField>
          <DetailField label="Contact #">{purchaseOrder.supplier.phone}</DetailField>
        </DetailCard>
        <DetailCard title="Information">
          <DetailField label="PO #">
            <span className="font-mono">{purchaseOrder.po_number}</span>
          </DetailField>
          <DetailField label="Date">{formatDate(purchaseOrder.order_date)}</DetailField>
          <DetailField label="Request Delivery">
            {purchaseOrder.request_delivery_date && formatDate(purchaseOrder.request_delivery_date)}
          </DetailField>
          <DetailField label="Terms">{purchaseOrder.terms}</DetailField>
          <DetailField label="Prepared By">{purchaseOrder.prepared_by}</DetailField>
        </DetailCard>
      </div>

      <div>
        <SectionTitle
          actions={
            editable && (
              <Button variant="outline" size="sm" onClick={() => openLineDialog({ mode: "add" })}>
                <Plus />
                Add Item
              </Button>
            )
          }
        >
          Item Table
        </SectionTitle>
        <DataList
          label="Purchase order lines"
          columns={lineColumns}
          rows={purchaseOrder.items}
          rowKey={(line) => line.id}
          isPending={false}
          onRetry={() => undefined}
          empty={{ title: "No items on this Purchase Order" }}
          rowActions={
            editable
              ? (line) => [
                  { label: "Edit", icon: Pencil, onClick: () => openLineDialog({ mode: "edit", line }) },
                  {
                    label: isLastLine ? "A Purchase Order needs at least one item" : "Remove",
                    icon: Trash2,
                    destructive: true,
                    disabled: isLastLine,
                    onClick: () => {
                      removeLineMutation.reset();
                      setRemovingLine(line);
                    },
                  },
                ]
              : undefined
          }
          footer={
            <div className="flex items-baseline justify-end gap-3 px-4 py-3">
              <span className="text-sm font-semibold md:text-ui">Grand Total</span>
              <span className="font-mono text-base font-bold">{formatMoney(purchaseOrder.total)}</span>
            </div>
          }
        />
      </div>

      <div>
        <SectionTitle>Discrepancies</SectionTitle>
        <DiscrepancyList
          query={discrepanciesQuery}
          onPageChange={setDiscrepancyPage}
          showDocument={false}
          empty={{ title: "No discrepancies", description: "Short, over and not-on-document items found while receiving appear here." }}
        />
      </div>

      {purchaseOrder.remarks && (
        <DetailCard title="Remarks">
          <p className="text-sm whitespace-pre-line text-foreground-soft md:text-ui">{purchaseOrder.remarks}</p>
        </DetailCard>
      )}

      {editingHeader && <PurchaseOrderHeaderDialog purchaseOrder={purchaseOrder} onClose={() => setEditingHeader(false)} />}

      {lineDialog && (
        <PurchaseOrderLineDialog
          key={lineDialog.mode === "edit" ? `edit-${lineDialog.line.id}` : "add"}
          title={lineDialog.mode === "edit" ? "Edit Item" : "Add Item"}
          submitLabel={lineDialog.mode === "edit" ? "Save Item" : "Add Item"}
          initial={lineDialog.mode === "edit" ? lineDraft(lineDialog.line) : undefined}
          itemLocked={lineDialog.mode === "edit"}
          isPending={lineMutation.isPending}
          serverError={lineMutation.error}
          onSubmit={saveLine}
          onClose={() => setLineDialog(null)}
        />
      )}

      <ConfirmDialog
        open={removingLine !== null}
        onOpenChange={(open) => !open && setRemovingLine(null)}
        title="Remove Item?"
        description={
          <>
            <span className="font-semibold">{removingLine?.item.name}</span> will be removed from{" "}
            <span className="font-mono">{purchaseOrder.po_number}</span>.
          </>
        }
        confirmLabel="Remove Item"
        destructive
        isPending={removeLineMutation.isPending}
        error={removeLineMutation.isError ? getErrorMessage(removeLineMutation.error) : null}
        onConfirm={confirmRemoveLine}
      />

      <ConfirmDialog
        open={statusAction !== null}
        onOpenChange={(open) => !open && setStatusAction(null)}
        title={statusAction === "cancel" ? "Cancel Purchase Order?" : "Mark Ready for Delivery?"}
        description={
          statusAction === "cancel" ? (
            <>
              <span className="font-mono font-semibold">{purchaseOrder.po_number}</span> will be cancelled and can't be
              received. This can't be undone.
            </>
          ) : (
            <>
              Do this once {purchaseOrder.supplier.name} confirms the items are ready or on the way. Details and items
              can't be changed after this.
            </>
          )
        }
        confirmLabel={statusAction === "cancel" ? "Cancel Purchase Order" : "Mark Ready for Delivery"}
        destructive={statusAction === "cancel"}
        isPending={statusMutation.isPending}
        error={statusMutation.isError ? getErrorMessage(statusMutation.error) : null}
        onConfirm={confirmStatusAction}
      />
    </div>
  );
}

function PurchaseOrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
