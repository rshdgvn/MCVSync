import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, PackageCheck, PackageOpen } from "lucide-react";
import { transferStatusKey } from "@/api/transfers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailCard, DetailField } from "@/components/DetailFields";
import { DetailHeader, type OverflowAction } from "@/components/DetailHeader";
import { DetailLoadError } from "@/components/DetailLoadError";
import { DiscrepancyList } from "@/components/discrepancies/DiscrepancyList";
import { QuantityProgress } from "@/components/QuantityProgress";
import { SectionTitle } from "@/components/SectionTitle";
import { StatusBadge } from "@/components/StatusBadge";
import { canCancelTransfer, canFulfillTransfer, canReceiveTransfer } from "@/components/transfers/transferRules";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeQuery } from "@/hooks/useAuth";
import { useDiscrepanciesQuery } from "@/hooks/useDiscrepancies";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCancelTransferMutation, useTransferQuery } from "@/hooks/useTransfers";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { INVENTORY_ACCESS_ROLES, requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { TransferDetail, TransferLine } from "@/types/transfer";
import type { User } from "@/types/user";

export const Route = createFileRoute("/_authenticated/purchasing/transfers/$transferId/")({
  beforeLoad: requireRole(...INVENTORY_ACCESS_ROLES),
  component: TransferDetailRoute,
});

function TransferDetailRoute() {
  const { transferId } = Route.useParams();
  return <TransferDetailPage key={transferId} id={Number(transferId)} />;
}

function TransferDetailPage({ id }: { id: number }) {
  const query = useTransferQuery(id);
  const user = useMeQuery().data;

  if (query.isPending) {
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

  if (query.isError || !user) {
    return (
      <DetailLoadError
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/purchasing/transfers"
        backLabel="Transfer Orders"
        entityLabel="Transfer Request"
      />
    );
  }

  return <TransferDetailView transfer={query.data} user={user} />;
}

const LINE_COLUMNS: DataListColumn<TransferLine>[] = [
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
    key: "requested",
    header: "Requested",
    align: "right",
    cell: (line) => <span className="font-mono">{formatQuantity(line.quantity_requested, line.item.unit?.code)}</span>,
  },
  {
    key: "picked",
    header: "Picked",
    className: "w-40",
    cell: (line) => <QuantityProgress value={line.quantity_picked} total={line.quantity_requested} />,
  },
  {
    key: "received",
    header: "Received",
    className: "w-40",
    cell: (line) =>
      line.quantity_picked > 0 ? <QuantityProgress value={line.quantity_received} total={line.quantity_picked} /> : "—",
  },
];

function TransferDetailView({ transfer, user }: { transfer: TransferDetail; user: User }) {
  const cancelMutation = useCancelTransferMutation(transfer.id);
  const isOnline = useOnlineStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [discrepancyPage, setDiscrepancyPage] = useState(1);
  const discrepanciesQuery = useDiscrepanciesQuery({
    page: discrepancyPage,
    reference_type: "transfer_request",
    reference_id: transfer.id,
  });
  const transferId = String(transfer.id);

  const overflowActions: OverflowAction[] = canCancelTransfer(user, transfer)
    ? [
        {
          label: "Cancel Transfer",
          icon: Ban,
          destructive: true,
          disabledReason: isOnline ? undefined : "Reconnect to cancel",
          onSelect: () => {
            cancelMutation.reset();
            setConfirmingCancel(true);
          },
        },
      ]
    : [];

  const primaryAction = canFulfillTransfer(user, transfer) ? (
    <Button render={<Link to="/purchasing/transfers/$transferId/pick" params={{ transferId }} />}>
      <PackageOpen />
      Prepare & Ship
    </Button>
  ) : canReceiveTransfer(user, transfer) ? (
    <Button render={<Link to="/purchasing/stock-receiving/transfers/$transferId" params={{ transferId }} />}>
      <PackageCheck />
      Receive Transfer
    </Button>
  ) : undefined;

  function confirmCancel() {
    return cancelMutation.mutateAsync(undefined, {
      onSuccess: () => {
        toast.success(`${transfer.transfer_number} cancelled.`);
        setConfirmingCancel(false);
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <DetailHeader
          backTo="/purchasing/transfers"
          backLabel="Transfer Orders"
          eyebrow="Transfer Order"
          title={<span className="font-mono">{transfer.transfer_number}</span>}
          meta={
            <>
              <StatusBadge status={transferStatusKey(transfer.status)} />
              <span>Requested {formatDateTime(transfer.created_at)}</span>
            </>
          }
          primaryAction={primaryAction}
          overflowActions={overflowActions}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Branch Details">
          <DetailField label="From Branch">{transfer.fulfilling_branch.name}</DetailField>
          <DetailField label="To Branch">{transfer.requesting_branch.name}</DetailField>
          <DetailField label="Requested By">{transfer.requested_by}</DetailField>
        </DetailCard>
        <DetailCard title="Information">
          <DetailField label="Transfer #">
            <span className="font-mono">{transfer.transfer_number}</span>
          </DetailField>
          <DetailField label="Requested">{formatDateTime(transfer.created_at)}</DetailField>
          <DetailField label="Shipped">{transfer.shipped_at && formatDateTime(transfer.shipped_at)}</DetailField>
          <DetailField label="Received">{transfer.received_at && formatDateTime(transfer.received_at)}</DetailField>
        </DetailCard>
      </div>

      <div>
        <SectionTitle>Items</SectionTitle>
        <DataList
          label="Transfer lines"
          columns={LINE_COLUMNS}
          rows={transfer.items}
          rowKey={(line) => line.id}
          isPending={false}
          onRetry={() => undefined}
          empty={{ title: "No items on this transfer" }}
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

      {transfer.remarks && (
        <DetailCard title="Notes">
          <p className="text-sm whitespace-pre-line text-foreground-soft md:text-ui">{transfer.remarks}</p>
        </DetailCard>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={(open) => !open && setConfirmingCancel(false)}
        title="Cancel Transfer Request?"
        description={
          <>
            <span className="font-mono font-semibold">{transfer.transfer_number}</span> will be cancelled. Any stock reserved
            for it at {transfer.fulfilling_branch.name} is released. This can't be undone.
          </>
        }
        confirmLabel="Cancel Transfer"
        destructive
        isPending={cancelMutation.isPending}
        error={cancelMutation.isError ? getErrorMessage(cancelMutation.error) : null}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
