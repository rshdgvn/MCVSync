import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCw, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import type { PendingMutation } from "@/db/schema";
import { removeMutation, retryMutation } from "@/db/pendingMutations";
import { useFailedMutations, usePendingMutationCount } from "@/hooks/usePendingMutations";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/stores/toast.store";

export const Route = createFileRoute("/_authenticated/sync-issues")({
  component: SyncIssuesPage,
});

function sendMutation(mutation: PendingMutation) {
  return api.request({ method: mutation.method, url: mutation.url, data: mutation.payload });
}

const COLUMNS: DataListColumn<PendingMutation>[] = [
  {
    key: "action",
    header: "Change",
    mobile: "title",
    cell: (mutation) => (
      <span className="font-mono text-xs">
        {mutation.method} {mutation.url}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: () => <StatusBadge status="failed" />,
  },
  {
    key: "reason",
    header: "Reason",
    mobile: "subtitle",
    cell: (mutation) => <span className="text-danger">{mutation.error_reason ?? "Unknown error"}</span>,
  },
  {
    key: "queued",
    header: "Queued",
    cell: (mutation) => formatDateTime(mutation.created_at),
  },
];

function SyncIssuesPage() {
  const failed = useFailedMutations();
  const openCount = usePendingMutationCount();
  const [discarding, setDiscarding] = useState<PendingMutation | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  async function retry(mutation: PendingMutation) {
    setRetryingId(mutation.id);
    const synced = await retryMutation(mutation, sendMutation, getErrorMessage);
    setRetryingId(null);
    if (synced) {
      toast.success("Change synced.");
    } else {
      toast.error("Still failing. The reason has been updated.");
    }
  }

  async function discard() {
    if (!discarding) {
      return;
    }
    await removeMutation(discarding.id);
    setDiscarding(null);
    toast.info("Change discarded.");
  }

  const waiting = openCount - failed.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sync Issues"
        description={
          waiting > 0
            ? `${waiting} change${waiting === 1 ? "" : "s"} waiting to sync. Failed changes need your decision below.`
            : "Changes made offline that the server rejected. Each one needs your decision."
        }
      />

      <DataList
        label="Failed offline changes"
        columns={COLUMNS}
        rows={failed}
        rowKey={(mutation) => mutation.id}
        isPending={false}
        onRetry={() => undefined}
        empty={{
          title: "No sync issues",
          description: "Every offline change has synced.",
        }}
        rowActions={(mutation) => [
          {
            label: "Retry",
            icon: RotateCw,
            disabled: retryingId === mutation.id,
            onClick: () => void retry(mutation),
          },
          { label: "Discard", icon: Trash2, destructive: true, onClick: () => setDiscarding(mutation) },
        ]}
      />

      <ConfirmDialog
        open={discarding !== null}
        onOpenChange={(open) => !open && setDiscarding(null)}
        title="Discard This Change?"
        description="The change will be removed from this device and never sent to the server. This can't be undone."
        confirmLabel="Discard Change"
        destructive
        onConfirm={discard}
      />
    </div>
  );
}
