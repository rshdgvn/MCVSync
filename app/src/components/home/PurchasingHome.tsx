import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AgingChip } from "@/components/AgingChip";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDiscrepanciesQuery } from "@/hooks/useDiscrepancies";
import { discrepancySubject } from "@/api/discrepancies";
import { useExpiringAlertsQuery, useLowStockAlertsQuery } from "@/hooks/useInventory";
import { useInventoryChannels, usePurchasingOwnBranchIds } from "@/hooks/useInventoryChannels";
import { usePurchaseOrdersQuery } from "@/hooks/usePurchaseOrders";
import { useTransfersQuery } from "@/hooks/useTransfers";
import { daysUntil, formatDate, formatNumber } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { statusInfo } from "@/lib/status";
import type { User } from "@/types/user";

const QUEUE_PAGE_SIZE = 5;
const SUMMARY_ONLY_PAGE_SIZE = 1;
const NEEDS_ACTION_LIMIT = 8;
const WAIT_WARN_DAYS = 3;
const WAIT_DANGER_DAYS = 7;

interface ActionEntry {
  key: string;
  kind: string;
  title: ReactNode;
  detail: string;
  since: string;
  link: Pick<LinkProps, "to" | "params">;
}

function daysWaiting(since: string): number {
  return Math.max(0, -daysUntil(since));
}

function oldestFirst<T>(rows: T[] | undefined): T[] {
  return [...(rows ?? [])].reverse();
}

function lastPage(meta: { last_page: number } | undefined): number {
  return meta?.last_page ?? 1;
}

export function PurchasingHome({ user }: { user: User }) {
  const isMain = user.branch?.is_main ?? false;
  const transferStatus = isMain ? "pending" : "shipped";
  useInventoryChannels(usePurchasingOwnBranchIds());

  const expiring = useExpiringAlertsQuery({ per_page: QUEUE_PAGE_SIZE });
  const lowStock = useLowStockAlertsQuery({ per_page: SUMMARY_ONLY_PAGE_SIZE });
  const orders = usePurchaseOrdersQuery({ status: "ready_for_delivery", per_page: QUEUE_PAGE_SIZE });
  const oldestOrders = usePurchaseOrdersQuery({
    status: "ready_for_delivery",
    per_page: QUEUE_PAGE_SIZE,
    page: lastPage(orders.data?.meta),
  });
  const transfers = useTransfersQuery({ status: transferStatus, per_page: QUEUE_PAGE_SIZE });
  const oldestTransfers = useTransfersQuery({
    status: transferStatus,
    per_page: QUEUE_PAGE_SIZE,
    page: lastPage(transfers.data?.meta),
  });
  const discrepancies = useDiscrepanciesQuery({ resolved: false, per_page: QUEUE_PAGE_SIZE });
  const oldestDiscrepancies = useDiscrepanciesQuery({
    resolved: false,
    per_page: QUEUE_PAGE_SIZE,
    page: lastPage(discrepancies.data?.meta),
  });

  const entries: ActionEntry[] = [
    ...oldestFirst(oldestOrders.data?.data).map((po): ActionEntry => ({
      key: `po-${po.id}`,
      kind: "Ready to Receive",
      title: <span className="font-mono">{po.po_number}</span>,
      detail: po.supplier.name,
      since: po.order_date,
      link: { to: "/purchasing/stock-receiving/purchase-orders/$purchaseOrderId", params: { purchaseOrderId: String(po.id) } },
    })),
    ...oldestFirst(oldestTransfers.data?.data).map((transfer): ActionEntry => ({
      key: `tr-${transfer.id}`,
      kind: isMain ? "To Fulfill" : "To Receive",
      title: <span className="font-mono">{transfer.transfer_number}</span>,
      detail: isMain ? `For ${transfer.requesting_branch.name}` : `From ${transfer.fulfilling_branch.name}`,
      since: transfer.created_at ?? new Date().toISOString(),
      link: isMain
        ? { to: "/purchasing/transfers/$transferId/pick", params: { transferId: String(transfer.id) } }
        : { to: "/purchasing/stock-receiving/transfers/$transferId", params: { transferId: String(transfer.id) } },
    })),
    ...oldestFirst(oldestDiscrepancies.data?.data).map((discrepancy): ActionEntry => ({
      key: `dis-${discrepancy.id}`,
      kind: `${statusInfo(discrepancy.type).label} Discrepancy`,
      title: discrepancySubject(discrepancy),
      detail: discrepancy.reference_number ?? "",
      since: discrepancy.created_at ?? new Date().toISOString(),
      link: { to: "/purchasing/discrepancies" },
    })),
  ]
    .sort((a, b) => a.since.localeCompare(b.since))
    .slice(0, NEEDS_ACTION_LIMIT);

  const queuesPending = oldestOrders.isPending || oldestTransfers.isPending || oldestDiscrepancies.isPending;
  const queueError = oldestOrders.error ?? oldestTransfers.error ?? oldestDiscrepancies.error;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Purchasing Home" description={`${user.branch?.name ?? "All branches"} · what needs attention today.`} />

      <StatCardGrid className="lg:grid-cols-3 xl:grid-cols-6">
        {expiring.data ? (
          <StatCard label="Near Expiry" value={formatNumber(expiring.data.meta.total)} sub="batches" link={{ to: "/inventory/expiring" }} />
        ) : (
          <StatCardSkeleton />
        )}
        {lowStock.data ? (
          <>
            <StatCard label="Low Stock" value={formatNumber(lowStock.data.summary.low_stock)} sub="at or below reorder point" link={{ to: "/inventory/low-stock" }} />
            <StatCard
              label="Out of Stock"
              value={formatNumber(lowStock.data.summary.out_of_stock)}
              sub="nothing available"
              link={{ to: "/inventory/low-stock" }}
            />
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
        {orders.data ? (
          <StatCard
            label="POs Ready to Receive"
            value={formatNumber(orders.data.counts.ready_for_delivery)}
            link={{ to: "/purchasing/stock-receiving" }}
          />
        ) : (
          <StatCardSkeleton />
        )}
        {transfers.data ? (
          <StatCard
            label={isMain ? "Transfers to Fulfill" : "Shipments to Receive"}
            value={formatNumber(isMain ? transfers.data.counts.pending : transfers.data.counts.shipped)}
            link={isMain ? { to: "/purchasing/transfers" } : { to: "/purchasing/stock-receiving", search: { tab: "transfers" } }}
          />
        ) : (
          <StatCardSkeleton />
        )}
        {discrepancies.data ? (
          <StatCard
            label="Unresolved Discrepancies"
            value={formatNumber(discrepancies.data.counts.unresolved)}
            link={{ to: "/purchasing/discrepancies" }}
          />
        ) : (
          <StatCardSkeleton />
        )}
      </StatCardGrid>

      <section aria-label="Needs action">
        <SectionTitle>Needs Action</SectionTitle>
        <div className="border border-border bg-card">
          {queuesPending ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : queueError ? (
            <ErrorState
              message={getErrorMessage(queueError)}
              onRetry={() => {
                void oldestOrders.refetch();
                void oldestTransfers.refetch();
                void oldestDiscrepancies.refetch();
              }}
            />
          ) : entries.length === 0 ? (
            <EmptyState title="Nothing waiting" description="Deliveries, transfers and discrepancies that need you appear here, oldest first." />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <li key={entry.key}>
                  <Link {...entry.link} className="flex min-h-11 items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status="pending" label={entry.kind} />
                        <span className="text-sm font-medium md:text-ui">{entry.title}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.detail} · since {formatDate(entry.since)}
                      </span>
                    </span>
                    <AgingChip days={daysWaiting(entry.since)} warnAt={WAIT_WARN_DAYS} dangerAt={WAIT_DANGER_DAYS} />
                    <ChevronRight className="size-4 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
