import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileDown, FilePlus2, Plus } from "lucide-react";
import { attachmentDocument, messageStatusKey } from "@/api/incomingMessages";
import { AgingChip } from "@/components/AgingChip";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import {
  COF_PERMISSIONS,
  hasPermission,
  MESSAGE_AGING_DANGER_DAYS,
  MESSAGE_AGING_WARN_DAYS,
} from "@/components/sales/cofRules";
import { LogMessageDialog } from "@/components/sales/LogMessageDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/useAuth";
import { useDownloadDocumentMutation } from "@/hooks/useDocuments";
import { PENDING_MESSAGES_PARAMS, useMessagesQuery } from "@/hooks/useIncomingMessages";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import type { IncomingMessage, MessageStatus } from "@/types/clientOrderForm";

export const Route = createFileRoute("/_authenticated/sales/intake")({
  beforeLoad: requireRole("sales", "super_admin"),
  component: IntakePage,
  errorComponent: RouteErrorFallback,
});

type MessageTab = MessageStatus | "all";

const HOURS_PER_DAY = 24;

function daysWaiting(message: IncomingMessage): number {
  if (!message.received_at || message.status !== "received") {
    return 0;
  }
  const hours = (Date.now() - new Date(message.received_at).getTime()) / 3_600_000;
  return hours > HOURS_PER_DAY ? Math.floor(hours / HOURS_PER_DAY) : 0;
}

function IntakePage() {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const isOnline = useOnlineStatus();
  const canCreate = hasPermission(user, COF_PERMISSIONS.create);
  const download = useDownloadDocumentMutation();
  const [tab, setTab] = useState<MessageTab>("received");
  const [page, setPage] = useState(1);
  const [logging, setLogging] = useState(false);

  const query = useMessagesQuery({ page, status: tab === "all" ? undefined : tab });
  const pending = useMessagesQuery(PENDING_MESSAGES_PARAMS);

  const tabs: FilterTab<MessageTab>[] = [
    { value: "received", label: "To Convert", count: pending.data?.meta.total },
    { value: "converted", label: "Converted" },
    { value: "all", label: "All Messages" },
  ];

  const columns: DataListColumn<IncomingMessage>[] = [
    {
      key: "received_at",
      header: "Received",
      mobile: "meta",
      cell: (message) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{formatDateTime(message.received_at)}</span>
          {daysWaiting(message) > 0 && (
            <AgingChip days={daysWaiting(message)} warnAt={MESSAGE_AGING_WARN_DAYS} dangerAt={MESSAGE_AGING_DANGER_DAYS} />
          )}
        </span>
      ),
    },
    { key: "client", header: "Client", mobile: "title", cell: (message) => <span className="font-medium">{message.client?.name}</span> },
    { key: "channel", header: "Channel", mobile: "badge", cell: (message) => <StatusBadge status={message.channel} /> },
    {
      key: "notes",
      header: "Notes",
      mobile: "subtitle",
      className: "max-w-64",
      cell: (message) => <span className="line-clamp-2 text-muted-foreground">{message.notes ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (message) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={messageStatusKey(message.status)} />
          {message.converted_cof_id && (
            <Link
              to="/sales/cofs/$cofId"
              params={{ cofId: String(message.converted_cof_id) }}
              onClick={(event) => event.stopPropagation()}
              className="font-mono text-xs font-semibold text-primary-hover hover:underline"
            >
              {message.converted_cof_number}
            </Link>
          )}
        </span>
      ),
    },
  ];

  const logButton = canCreate && (
    <Button disabled={!isOnline} title={isOnline ? undefined : "Reconnect to log a message"} onClick={() => setLogging(true)}>
      <Plus />
      Log Message
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        description="Orders clients sent by Messenger, Viber or email, waiting to become Client Order Forms."
        primaryAction={logButton}
      />

      <FilterTabs
        ariaLabel="Filter messages by status"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        tabs={tabs}
      />

      <DataList
        label="Incoming messages"
        columns={columns}
        rows={query.data?.data}
        rowKey={(message) => message.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        isRefreshing={query.isFetching && query.isPlaceholderData}
        empty={
          tab === "received"
            ? { title: "Nothing to convert", description: "Messages you log appear here until they become a COF.", action: logButton || undefined }
            : { title: "No messages yet", description: "Log the orders clients send outside the portal." }
        }
        rowActions={(message) => [
          {
            label: "Download Attachment",
            icon: FileDown,
            onClick: () => download.mutate(attachmentDocument(message)),
          },
          ...(message.status === "received" && canCreate
            ? [
                {
                  label: "Convert to COF",
                  icon: FilePlus2,
                  onClick: () =>
                    void navigate({
                      to: "/sales/cofs/new",
                      search: { message_id: message.id, client_id: message.client?.id },
                    }),
                },
              ]
            : []),
        ]}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />

      {logging && <LogMessageDialog onClose={() => setLogging(false)} />}
    </div>
  );
}
