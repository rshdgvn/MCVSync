import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CircleCheck, CircleX, FileDown, MessageSquareWarning, Send, Undo2 } from "lucide-react";
import { deliveryReceiptDocument } from "@/api/clientOrderForms";
import { attachmentDocument } from "@/api/incomingMessages";
import { insufficientStockOf } from "@/api/transfers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailCard, DetailField } from "@/components/DetailFields";
import { DetailHeader, type OverflowAction } from "@/components/DetailHeader";
import { DetailLoadError } from "@/components/DetailLoadError";
import { DiscrepancyList } from "@/components/discrepancies/DiscrepancyList";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { QuantityProgress } from "@/components/QuantityProgress";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { CofLineEditor } from "@/components/sales/CofLineEditor";
import {
  canCancelInstantly,
  COF_PERMISSIONS,
  draftLinesFromCof,
  estimatedLineTotal,
  hasPermission,
  lineDiffers,
  linesPayload,
  missingReasons,
  type DraftCofLine,
} from "@/components/sales/cofRules";
import { CofStatusTimeline } from "@/components/sales/CofStatusTimeline";
import { ForwardShortageDialog } from "@/components/sales/ForwardShortageDialog";
import { SectionTitle } from "@/components/SectionTitle";
import { StatusBadge } from "@/components/StatusBadge";
import { StickyActionBar } from "@/components/StickyActionBar";
import { TabBar } from "@/components/TabBar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMeQuery } from "@/hooks/useAuth";
import {
  useCancelCofMutation,
  useCofQuery,
  useConfirmCofCancellationMutation,
  useDeclineCofCancellationMutation,
  useForwardCofMutation,
  useSendCofForRevisionMutation,
  useStandingDiscountsQuery,
  useUpdateCofMutation,
} from "@/hooks/useClientOrderForms";
import { useDownloadDocumentMutation } from "@/hooks/useDocuments";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getErrorMessage, getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { CofDetail, CofLine } from "@/types/clientOrderForm";
import type { InsufficientStock } from "@/types/transfer";
import type { User } from "@/types/user";

export const Route = createFileRoute("/_authenticated/sales/cofs/$cofId")({
  beforeLoad: requireRole("sales", "accounting", "admin", "super_admin"),
  component: CofRoute,
  errorComponent: RouteErrorFallback,
});

const REVISION_REASON_MAX_LENGTH = 1000;
const OFFLINE_REASON = "Reconnect to make changes";

function CofRoute() {
  const { cofId } = Route.useParams();
  const query = useCofQuery(Number(cofId));
  const user = useMeQuery().data;

  if (query.isPending || !user) {
    return <CofSkeleton />;
  }

  if (query.isError) {
    return (
      <DetailLoadError
        error={query.error}
        onRetry={() => void query.refetch()}
        backTo="/sales/cofs"
        backLabel="Client Order Forms"
        entityLabel="Client Order Form"
      />
    );
  }

  return query.data.order_status === "pending_approval" ? (
    <CofReview key={query.data.updated_at} cof={query.data} user={user} />
  ) : (
    <CofDetailView cof={query.data} user={user} />
  );
}

function headerMeta(cof: CofDetail) {
  return (
    <>
      <StatusBadge status={cof.order_status} />
      {cof.cancellation_requested && <StatusBadge status="cancellation_requested" />}
      {cof.payment && <StatusBadge status={cof.payment.status} />}
      <StatusBadge status={cof.source_type} />
      <span>{cof.client?.name}</span>
      <span>{formatDate(cof.created_at)}</span>
    </>
  );
}

function MatchIndicator({ lines }: { lines: DraftCofLine[] }) {
  const portalLines = lines.filter((line) => line.requested !== null);
  if (portalLines.length === 0) {
    return null;
  }
  const differing = portalLines.filter(lineDiffers).length;
  return differing === 0 ? (
    <StatusBadge status="completed" label={`Matches client's submission — ${portalLines.length}/${portalLines.length} items`} />
  ) : (
    <StatusBadge
      status="needs_revision"
      label={`${differing} of ${portalLines.length} ${portalLines.length === 1 ? "item differs" : "items differ"} from the client's submission`}
    />
  );
}

function SourcePanel({ cof }: { cof: CofDetail }) {
  const download = useDownloadDocumentMutation();

  if (cof.source) {
    return (
      <DetailCard title="Client's Submission (read-only)">
        <DetailField label="Submitted">{formatDateTime(cof.source.submitted_at)}</DetailField>
        <DetailField label="Client Notes">{cof.source.notes}</DetailField>
        <div className="grid gap-1">
          {cof.source.items.map((line) => (
            <div key={line.item.id} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5 last:border-0">
              <span className="text-sm md:text-ui">{line.item.name}</span>
              <span className="font-mono text-sm font-bold">×{line.quantity}</span>
            </div>
          ))}
        </div>
      </DetailCard>
    );
  }

  const message = cof.source_message;
  return (
    <DetailCard title="Logged Message (read-only)">
      <DetailField label="Channel">{message && <StatusBadge status={message.channel} />}</DetailField>
      <DetailField label="Received">{formatDateTime(message?.received_at)}</DetailField>
      <DetailField label="Logged By">{message?.logged_by}</DetailField>
      <DetailField label="Notes">{message?.notes}</DetailField>
      {message && (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => download.mutate(attachmentDocument(message))}>
          <FileDown />
          {message.attachment_name}
        </Button>
      )}
    </DetailCard>
  );
}

type ReviewTab = "source" | "cof";
type ReviewAction = "forward" | "revision" | "cancel" | null;

function CofReview({ cof, user }: { cof: CofDetail; user: User }) {
  const isOnline = useOnlineStatus();
  const canEdit = hasPermission(user, COF_PERMISSIONS.create);
  const canForward = hasPermission(user, COF_PERMISSIONS.forward);
  const initialLines = useMemo(() => draftLinesFromCof(cof), [cof]);
  const [lines, setLines] = useState(initialLines);
  const [terms, setTerms] = useState(cof.terms ?? "");
  const [deliveryDate, setDeliveryDate] = useState(cof.request_delivery_date ?? "");
  const [remarks, setRemarks] = useState(cof.remarks ?? "");
  const [tab, setTab] = useState<ReviewTab>("cof");
  const [action, setAction] = useState<ReviewAction>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [shortage, setShortage] = useState<InsufficientStock | null>(null);
  const discounts = useStandingDiscountsQuery(cof.client?.id ?? null);
  const updateMutation = useUpdateCofMutation(cof.id);
  const forwardMutation = useForwardCofMutation(cof.id);
  const revisionMutation = useSendCofForRevisionMutation(cof.id);
  const cancelMutation = useCancelCofMutation(cof.id);

  const payload = {
    terms: terms.trim() || null,
    request_delivery_date: deliveryDate || null,
    remarks: remarks.trim() || null,
    items: linesPayload(lines),
  };
  const initialPayload = {
    terms: cof.terms,
    request_delivery_date: cof.request_delivery_date,
    remarks: cof.remarks,
    items: linesPayload(initialLines),
  };
  const dirty = JSON.stringify(payload) !== JSON.stringify(initialPayload);
  const unpriced = cof.needs_pricing_item_ids.length;
  const reasonsMissing = missingReasons(lines).length;
  const serverErrors = getFieldErrors(updateMutation.error);
  const lineErrors = Object.fromEntries(
    Object.entries(serverErrors)
      .map(([field, message]) => [Number(field.match(/^items\.(\d+)\./)?.[1]), message] as const)
      .filter(([index]) => Number.isInteger(index)),
  );
  const forwardBlocker = !isOnline
    ? OFFLINE_REASON
    : dirty
      ? "Save your changes before forwarding."
      : unpriced > 0
        ? `Awaiting Accounting: ${unpriced} ${unpriced === 1 ? "item has" : "items have"} no price for this client yet.`
        : null;
  const estimatedTotal = lines.reduce((sum, line) => sum + (estimatedLineTotal(line) ?? 0), 0);

  function save() {
    if (reasonsMissing > 0) {
      toast.error("Add a reason for each line that differs from the client's request.");
      return;
    }
    return updateMutation.mutateAsync(payload, { onSuccess: (updated) => toast.success(`${updated.cof_number} saved.`) });
  }

  function confirmForward() {
    return forwardMutation.mutateAsync(undefined, {
      onSuccess: (updated) => {
        toast.success(`${updated.cof_number} forwarded to Purchasing. Stock is reserved.`);
        setAction(null);
      },
      onError: (error) => {
        const insufficient = insufficientStockOf(error);
        if (insufficient) {
          setAction(null);
          setShortage(insufficient);
        }
      },
    });
  }

  function confirmRevision() {
    const reason = revisionReason.trim();
    if (!reason) {
      setRevisionError("Tell the client what to change.");
      return;
    }
    return revisionMutation.mutateAsync(reason, {
      onSuccess: (updated) => {
        toast.info(`${updated.cof_number} sent back to the client.`);
        setAction(null);
      },
    });
  }

  function confirmCancel() {
    return cancelMutation.mutateAsync(undefined, {
      onSuccess: (updated) => {
        toast.info(`${updated.cof_number} cancelled.`);
        setAction(null);
      },
    });
  }

  function openAction(next: Exclude<ReviewAction, null>) {
    forwardMutation.reset();
    revisionMutation.reset();
    cancelMutation.reset();
    setRevisionReason("");
    setRevisionError(null);
    setAction(next);
  }

  const shortageLine = shortage ? cof.items.find((line) => line.item.id === shortage.item_id) : undefined;
  const overflowActions: OverflowAction[] = canEdit
    ? [
        ...(cof.source_type === "portal"
          ? [
              {
                label: "Send Back for Revision",
                icon: Undo2,
                disabledReason: isOnline ? undefined : OFFLINE_REASON,
                onSelect: () => openAction("revision"),
              },
            ]
          : []),
        {
          label: "Cancel COF",
          icon: Ban,
          destructive: true,
          disabledReason: isOnline ? undefined : OFFLINE_REASON,
          onSelect: () => openAction("cancel"),
        },
      ]
    : [];

  const forwardButton = canForward && (
    <Button disabled={forwardBlocker !== null} title={forwardBlocker ?? undefined} onClick={() => openAction("forward")}>
      <Send />
      Forward to Purchasing
    </Button>
  );
  const saveButton = canEdit && (
    <LoadingButton
      variant="outline"
      disabled={!dirty || !isOnline}
      title={isOnline ? undefined : OFFLINE_REASON}
      isPending={updateMutation.isPending}
      pendingText="Saving…"
      onClick={save}
    >
      Save
    </LoadingButton>
  );

  const sourcePanel = <SourcePanel cof={cof} />;
  const cofPanel = (
    <div className="flex flex-col gap-4">
      <section className="border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Generated COF</SectionTitle>
          <MatchIndicator lines={lines} />
        </div>
        <FormError message={getGeneralError(updateMutation.error, ["terms", "request_delivery_date", "remarks", "items", ...Object.keys(serverErrors)])} />
        <div className="grid gap-4 md:grid-cols-3 md:gap-3">
          <FormField label="Terms" htmlFor="review-terms" layout="stacked" error={serverErrors.terms}>
            <Input
              {...fieldA11yProps("review-terms", serverErrors.terms)}
              disabled={!canEdit}
              maxLength={100}
              className="text-base md:text-ui"
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
            />
          </FormField>
          <FormField label="Delivery Date" htmlFor="review-delivery" layout="stacked" error={serverErrors.request_delivery_date}>
            <Input
              {...fieldA11yProps("review-delivery", serverErrors.request_delivery_date)}
              type="date"
              disabled={!canEdit}
              className="text-base md:text-ui"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
          </FormField>
          <FormField label="Remarks" htmlFor="review-remarks" layout="stacked" error={serverErrors.remarks}>
            <Input
              {...fieldA11yProps("review-remarks", serverErrors.remarks)}
              disabled={!canEdit}
              maxLength={2000}
              className="text-base md:text-ui"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </FormField>
        </div>
      </section>
      <CofLineEditor
        lines={lines}
        onChange={setLines}
        readOnly={!canEdit}
        lineErrors={lineErrors}
        newLineDiscount={(itemId) => discounts.data?.get(itemId) ?? 0}
      />
      <div className="flex items-baseline justify-end gap-3">
        <span className="text-sm font-semibold md:text-ui">Estimated Total</span>
        <span className="font-mono text-base font-bold">{formatMoney(estimatedTotal)}</span>
      </div>
      {(forwardBlocker || reasonsMissing > 0) && (
        <p className="text-sm text-warning md:text-ui">
          {reasonsMissing > 0 ? "Add a reason for each line that differs from the client's request." : forwardBlocker}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/sales/cofs"
        backLabel="Client Order Forms"
        eyebrow="Review Client Order Form"
        title={<span className="font-mono">{cof.cof_number}</span>}
        meta={headerMeta(cof)}
        overflowActions={overflowActions}
        primaryAction={
          <span className="hidden gap-2 md:flex">
            {saveButton}
            {forwardButton}
          </span>
        }
      />

      <div className="md:hidden">
        <TabBar
          ariaLabel="Review panels"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "cof", label: "Generated COF" },
            { value: "source", label: "Source" },
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(16rem,20rem)_1fr]">
        <div className={tab === "source" ? undefined : "hidden md:block"}>{sourcePanel}</div>
        <div className={tab === "cof" ? undefined : "hidden md:block"}>{cofPanel}</div>
      </div>

      {(saveButton || forwardButton) && (
        <StickyActionBar>
          {saveButton}
          {forwardButton}
        </StickyActionBar>
      )}

      <ConfirmDialog
        open={action === "forward"}
        onOpenChange={(open) => !open && setAction(null)}
        title="Forward to Purchasing?"
        description={
          <>
            <span className="font-mono font-semibold">{cof.cof_number}</span> locks in Accounting's current prices, reserves the
            stock, and goes to Purchasing for picking. Lines can't be changed after this.
          </>
        }
        confirmLabel="Forward to Purchasing"
        isPending={forwardMutation.isPending}
        error={forwardMutation.isError && !insufficientStockOf(forwardMutation.error) ? getErrorMessage(forwardMutation.error) : null}
        onConfirm={confirmForward}
      />

      <ConfirmDialog
        open={action === "revision"}
        onOpenChange={(open) => !open && setAction(null)}
        title="Send Back for Revision?"
        description={
          <>
            {cof.client?.name} sees your reason in the portal and can edit and resubmit{" "}
            <span className="font-mono font-semibold">{cof.cof_number}</span>.
          </>
        }
        confirmLabel="Send Back"
        isPending={revisionMutation.isPending}
        error={getGeneralError(revisionMutation.error, ["revision_reason"])}
        onConfirm={confirmRevision}
      >
        <FormField
          label="Reason"
          htmlFor="revision-reason"
          required
          error={revisionError ?? getFieldErrors(revisionMutation.error).revision_reason}
        >
          <Textarea
            {...fieldA11yProps("revision-reason", revisionError ?? undefined)}
            rows={3}
            maxLength={REVISION_REASON_MAX_LENGTH}
            value={revisionReason}
            onChange={(event) => setRevisionReason(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>

      <ConfirmDialog
        open={action === "cancel"}
        onOpenChange={(open) => !open && setAction(null)}
        title="Cancel This COF?"
        description={
          <>
            <span className="font-mono font-semibold">{cof.cof_number}</span> is cancelled for {cof.client?.name}. Nothing has been
            reserved yet. This can't be undone.
          </>
        }
        confirmLabel="Cancel COF"
        destructive
        isPending={cancelMutation.isPending}
        error={cancelMutation.isError ? getErrorMessage(cancelMutation.error) : null}
        onConfirm={confirmCancel}
      />

      {shortage && (
        <ForwardShortageDialog
          shortage={shortage}
          itemName={shortageLine?.item.name ?? `Item #${shortage.item_id}`}
          unit={shortageLine?.item.unit?.code ?? null}
          onClose={() => setShortage(null)}
        />
      )}
    </div>
  );
}

type CancellationDecision = "confirm" | "decline" | "cancel" | null;

function CofDetailView({ cof, user }: { cof: CofDetail; user: User }) {
  const isOnline = useOnlineStatus();
  const download = useDownloadDocumentMutation();
  const confirmMutation = useConfirmCofCancellationMutation(cof.id);
  const declineMutation = useDeclineCofCancellationMutation(cof.id);
  const cancelMutation = useCancelCofMutation(cof.id);
  const [decision, setDecision] = useState<CancellationDecision>(null);
  const canDecide = hasPermission(user, COF_PERMISSIONS.confirmCancellation);
  const canCancel = hasPermission(user, COF_PERMISSIONS.create) && canCancelInstantly(cof.order_status);
  const picked = cof.items.some((line) => line.quantity_picked > 0);
  const document = deliveryReceiptDocument(cof);
  const mutation = decision === "confirm" ? confirmMutation : decision === "decline" ? declineMutation : cancelMutation;

  const overflowActions: OverflowAction[] = [
    ...(document
      ? [
          {
            label: "Download DR",
            icon: FileDown,
            disabledReason: isOnline ? undefined : "Reconnect to download",
            onSelect: () => download.mutate(document),
          },
        ]
      : []),
    ...(canCancel
      ? [
          {
            label: "Cancel COF",
            icon: Ban,
            destructive: true,
            disabledReason: isOnline ? undefined : OFFLINE_REASON,
            onSelect: () => {
              cancelMutation.reset();
              setDecision("cancel");
            },
          },
        ]
      : []),
  ];

  function decide() {
    const done = decision === "confirm" ? "cancelled" : decision === "decline" ? "kept; the request was declined" : "cancelled";
    return mutation.mutateAsync(undefined, {
      onSuccess: (updated) => {
        toast.info(`${updated.cof_number} ${done}.`);
        setDecision(null);
      },
    });
  }

  const columns: DataListColumn<CofLine>[] = [
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: (line) => (
        <span className="flex flex-col">
          <span className="font-medium">{line.item.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
          {line.differs_from_request && (
            <span className="text-xs text-warning">Adjusted: {line.differs_from_request_reason}</span>
          )}
        </span>
      ),
    },
    {
      key: "picked",
      header: "Picked / Ordered",
      className: "w-44",
      cell: (line) => <QuantityProgress value={line.quantity_picked} total={line.quantity} />,
    },
    { key: "unit", header: "Unit", mobile: "meta", cell: (line) => line.item.unit?.code ?? "—" },
    {
      key: "unit_cost",
      header: "Unit Cost",
      align: "right",
      mobile: "meta",
      cell: (line) => <span className="font-mono">{formatMoney(line.unit_cost)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      mobile: "meta",
      cell: (line) => <span className="font-mono">{line.discount_percent}%</span>,
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
      <DetailHeader
        backTo="/sales/cofs"
        backLabel="Client Order Forms"
        eyebrow="Client Order Form"
        title={<span className="font-mono">{cof.cof_number}</span>}
        meta={headerMeta(cof)}
        overflowActions={overflowActions}
      />

      {cof.cancellation_requested && (
        <Alert variant="destructive">
          <Ban />
          <AlertDescription>
            <span className="font-semibold">The client asked to cancel this order.</span>{" "}
            {picked
              ? "Picking has started. Confirming returns the picked stock to its batches and releases the rest."
              : "Confirming releases the reserved stock."}
            {canDecide && (
              <span className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!isOnline}
                  title={isOnline ? undefined : OFFLINE_REASON}
                  onClick={() => {
                    confirmMutation.reset();
                    setDecision("confirm");
                  }}
                >
                  <CircleCheck />
                  Confirm Cancellation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isOnline}
                  title={isOnline ? undefined : OFFLINE_REASON}
                  onClick={() => {
                    declineMutation.reset();
                    setDecision("decline");
                  }}
                >
                  <CircleX />
                  Decline
                </Button>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {cof.order_status === "needs_revision" && (
        <Alert>
          <Undo2 />
          <AlertDescription>
            <span className="font-semibold text-foreground">Sent back to the client.</span> {cof.revision_reason}
          </AlertDescription>
        </Alert>
      )}

      {cof.issue && (
        <Alert variant="destructive">
          <MessageSquareWarning />
          <AlertDescription>
            <span className="font-semibold">Issue reported {formatDateTime(cof.issue.reported_at)}:</span> {cof.issue.description}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_minmax(14rem,18rem)]">
        <DetailCard title="Client Details">
          <DetailField label="Client">{cof.client?.name}</DetailField>
          <DetailField label="Address">{cof.client?.address}</DetailField>
          <DetailField label="Contact #">{cof.client?.contact}</DetailField>
        </DetailCard>
        <DetailCard title="Information">
          <DetailField label="COF #">
            <span className="font-mono">{cof.cof_number}</span>
          </DetailField>
          <DetailField label="DR #">{cof.dr_number && <span className="font-mono">{cof.dr_number}</span>}</DetailField>
          <DetailField label="Delivery Date">{cof.request_delivery_date && formatDate(cof.request_delivery_date)}</DetailField>
          <DetailField label="Terms">{cof.terms}</DetailField>
          <DetailField label="Prepared By">{cof.prepared_by}</DetailField>
          <DetailField label="Checked By">{cof.checked_by}</DetailField>
          {cof.payment && (
            <DetailField label="Payment">
              <span className="inline-flex items-center gap-2">
                <StatusBadge status={cof.payment.status} />
                {cof.payment.expected_payment_date && `due ${formatDate(cof.payment.expected_payment_date)}`}
              </span>
            </DetailField>
          )}
        </DetailCard>
        <DetailCard title="Status">
          <CofStatusTimeline cof={cof} />
        </DetailCard>
      </div>

      <div>
        <SectionTitle>Item Table</SectionTitle>
        <DataList
          label="COF lines"
          columns={columns}
          rows={cof.items}
          rowKey={(line) => line.id}
          isPending={false}
          onRetry={() => undefined}
          empty={{ title: "No items on this COF" }}
          footer={
            <div className="flex items-baseline justify-end gap-3 px-4 py-3">
              <span className="text-sm font-semibold md:text-ui">Grand Total</span>
              <span className="font-mono text-base font-bold">{formatMoney(cof.total)}</span>
            </div>
          }
        />
      </div>

      <div>
        <SectionTitle>Discrepancies</SectionTitle>
        <DiscrepancyList
          rows={cof.discrepancies}
          showDocument={false}
          empty={{ title: "No discrepancies", description: "Lines Purchasing couldn't fully pick appear here." }}
        />
      </div>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision === "decline" ? "Decline Cancellation?" : "Cancel This Order?"}
        description={
          decision === "decline" ? (
            <>
              <span className="font-mono font-semibold">{cof.cof_number}</span> continues as normal and the client's request is
              cleared.
            </>
          ) : decision === "confirm" && picked ? (
            <>
              <span className="font-mono font-semibold">{cof.cof_number}</span> is cancelled. Picked stock goes back to the batches it
              came from, the rest of the reservation is released, and the DR number is voided.
            </>
          ) : (
            <>
              <span className="font-mono font-semibold">{cof.cof_number}</span> is cancelled and any reserved stock is released. This
              can't be undone.
            </>
          )
        }
        confirmLabel={decision === "decline" ? "Decline Request" : "Cancel Order"}
        destructive={decision !== "decline"}
        isPending={mutation.isPending}
        error={mutation.isError ? getErrorMessage(mutation.error) : null}
        onConfirm={decide}
      />
    </div>
  );
}

function CofSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-7 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
