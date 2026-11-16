import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { paymentReferenceLabel } from "@/api/payments";
import { ApprovePaymentDialog } from "@/components/accounting/ApprovePaymentDialog";
import { AgingChip } from "@/components/AgingChip";
import { DataList, type DataListColumn } from "@/components/DataList";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/StatCard";
import { useMeQuery } from "@/hooks/useAuth";
import { usePendingPaymentsQuery } from "@/hooks/usePayments";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ACCOUNTING_ROLES, canManageAccounting, requireRole } from "@/lib/rbac";
import type { Payment } from "@/types/accounting";

export const Route = createFileRoute("/_authenticated/accounting/pending-payments")({
  beforeLoad: requireRole(...ACCOUNTING_ROLES),
  component: PendingPaymentsPage,
});

const OVERDUE_WARN_DAYS = 1;
const OVERDUE_DANGER_DAYS = 31;

const COLUMNS: DataListColumn<Payment>[] = [
  {
    key: "reference",
    header: "Reference",
    mobile: "title",
    cell: (payment) => <span className="font-mono text-xs font-semibold">{paymentReferenceLabel(payment)}</span>,
  },
  {
    key: "order_total",
    header: "Order Total",
    align: "right",
    cell: (payment) => <span className="font-mono font-semibold">{formatMoney(payment.order_total)}</span>,
  },
  { key: "payment_terms", header: "Payment Terms", cell: (payment) => payment.payment_terms },
  { key: "expected", header: "Expected Date", cell: (payment) => formatDate(payment.expected_payment_date) },
  {
    key: "days_overdue",
    header: "Days Overdue",
    mobile: "badge",
    cell: (payment) =>
      payment.days_overdue === null || payment.days_overdue === undefined ? (
        <span className="text-xs text-muted-foreground">No due date</span>
      ) : payment.days_overdue === 0 ? (
        <span className="text-xs text-muted-foreground">Within terms</span>
      ) : (
        <AgingChip days={payment.days_overdue} warnAt={OVERDUE_WARN_DAYS} dangerAt={OVERDUE_DANGER_DAYS} />
      ),
  },
];

function PendingPaymentsPage() {
  const user = useMeQuery().data;
  const canApprove = user ? canManageAccounting(user) : false;
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<Payment | null>(null);
  const query = usePendingPaymentsQuery({ page });
  const summary = query.data?.summary;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pending Payments"
        description="Orders delivered and waiting for payment. Approve each one once the money is received."
      />

      <StatCardGrid className="lg:grid-cols-3">
        {summary ? (
          <>
            <StatCard label="Total Pending" value={formatNumber(summary.total)} />
            <StatCard label="Overdue" value={formatNumber(summary.overdue)} />
            <StatCard label="Within Terms" value={formatNumber(summary.within_terms)} />
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
      </StatCardGrid>

      <DataList
        label="Pending payments"
        columns={COLUMNS}
        rows={query.data?.data}
        rowKey={(payment) => payment.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={6}
        empty={{
          title: "No payments due",
          description: "Payments appear here once Sales marks a Client Order Form delivered.",
        }}
        rowActions={canApprove ? (payment) => [{ label: "Approve", icon: CheckCircle2, onClick: () => setApproving(payment) }] : undefined}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />

      {approving && <ApprovePaymentDialog key={approving.id} payment={approving} onClose={() => setApproving(null)} />}
    </div>
  );
}
