import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PAYMENT_METHOD_LABELS, paymentReferenceLabel } from "@/api/payments";
import { DataList, type DataListColumn } from "@/components/DataList";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { usePaymentHistoryQuery } from "@/hooks/usePayments";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ACCOUNTING_ROLES, requireRole } from "@/lib/rbac";
import type { Payment } from "@/types/accounting";

export const Route = createFileRoute("/_authenticated/accounting/payment-history")({
  beforeLoad: requireRole(...ACCOUNTING_ROLES),
  component: PaymentHistoryPage,
});

const COLUMNS: DataListColumn<Payment>[] = [
  {
    key: "reference",
    header: "Reference",
    mobile: "title",
    cell: (payment) => <span className="font-mono text-xs font-semibold">{paymentReferenceLabel(payment)}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    mobile: "badge",
    cell: (payment) => <span className="font-mono font-semibold">{formatMoney(payment.order_total)}</span>,
  },
  { key: "payment_terms", header: "Payment Terms", cell: (payment) => payment.payment_terms },
  {
    key: "method",
    header: "Payment Method",
    mobile: "subtitle",
    cell: (payment) => (payment.method ? PAYMENT_METHOD_LABELS[payment.method] : "—"),
  },
  { key: "date_received", header: "Date Received", cell: (payment) => formatDate(payment.date_received) },
  {
    key: "reference_note",
    header: "Payment Reference",
    cell: (payment) => <span className="text-muted-foreground">{payment.reference_note ?? "—"}</span>,
  },
  {
    key: "approved",
    header: "Date Approved",
    cell: (payment) => (
      <span className="flex flex-col">
        <span>{formatDateTime(payment.approved_at)}</span>
        <span className="text-xs text-muted-foreground">{payment.approved_by ?? "—"}</span>
      </span>
    ),
  },
];

function PaymentHistoryPage() {
  const [page, setPage] = useState(1);
  const query = usePaymentHistoryQuery({ page });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Payment History" description="Every approved payment, newest first. This log is read-only." />
      <DataList
        label="Payment history"
        columns={COLUMNS}
        rows={query.data?.data}
        rowKey={(payment) => payment.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        skeletonRows={6}
        empty={{ title: "No approved payments yet", description: "Payments appear here once they are approved." }}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />
    </div>
  );
}
