import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/api/salesCatalog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { DetailHeader } from "@/components/DetailHeader";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { Pagination } from "@/components/Pagination";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { ClientCombobox } from "@/components/sales/ClientCombobox";
import { CofLineEditor } from "@/components/sales/CofLineEditor";
import { COF_PERMISSIONS, hasPermission, linesPayload, type DraftCofLine } from "@/components/sales/cofRules";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectField } from "@/components/SelectField";
import { StatusBadge } from "@/components/StatusBadge";
import { StickyActionBar } from "@/components/StickyActionBar";
import { SubmitForm } from "@/components/SubmitForm";
import { TabBar } from "@/components/TabBar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMeQuery } from "@/hooks/useAuth";
import {
  cofQueryOptions,
  salesCatalogKeys,
  useCofsQuery,
  useCreateManualCofMutation,
  useStandingDiscountsQuery,
} from "@/hooks/useClientOrderForms";
import { useMessagesQuery } from "@/hooks/useIncomingMessages";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatDate, formatDateTime, toIsoDate } from "@/lib/format";
import { requireRole } from "@/lib/rbac";
import { statusInfo } from "@/lib/status";
import { toast } from "@/stores/toast.store";
import type { ClientProfile, CofSummary } from "@/types/clientOrderForm";

type EntryPath = "portal" | "manual";

interface NewCofSearch {
  message_id?: number;
  client_id?: number;
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const Route = createFileRoute("/_authenticated/sales/cofs/new")({
  beforeLoad: requireRole("sales", "super_admin"),
  validateSearch: (search: Record<string, unknown>): NewCofSearch => ({
    message_id: positiveInteger(search.message_id),
    client_id: positiveInteger(search.client_id),
  }),
  component: NewCofPage,
  errorComponent: RouteErrorFallback,
});

const FORM_FIELDS = ["client_id", "incoming_message_id", "terms", "request_delivery_date", "remarks", "items"];

function NewCofPage() {
  const search = Route.useSearch();
  const [path, setPath] = useState<EntryPath>(search.message_id ? "manual" : "portal");

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader backTo="/sales/cofs" backLabel="Client Order Forms" eyebrow="Client Order Form" title="New COF" />
      <TabBar
        ariaLabel="How the order came in"
        value={path}
        onChange={setPath}
        tabs={[
          { value: "portal", label: "From Portal Order" },
          { value: "manual", label: "Manual (Logged Message)" },
        ]}
      />
      {path === "portal" ? <PortalOrderPicker /> : <ManualCofForm messageId={search.message_id} clientId={search.client_id} />}
    </div>
  );
}

function PortalOrderPicker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useCofsQuery({ page, status: "pending_approval", source_type: "portal" });

  function open(cof: CofSummary) {
    void navigate({ to: "/sales/cofs/$cofId", params: { cofId: String(cof.id) } });
  }

  const columns: DataListColumn<CofSummary>[] = [
    {
      key: "cof_number",
      header: "COF #",
      mobile: "title",
      cell: (cof) => <span className="font-mono text-xs font-semibold text-primary-hover">{cof.cof_number}</span>,
    },
    { key: "client", header: "Client", mobile: "subtitle", cell: (cof) => cof.client?.name },
    { key: "submitted", header: "Submitted", mobile: "meta", cell: (cof) => formatDateTime(cof.created_at) },
    { key: "items", header: "Items", align: "right", mobile: "meta", cell: (cof) => <span className="font-mono">{cof.items_count}</span> },
    { key: "status", header: "Status", mobile: "badge", cell: (cof) => <StatusBadge status={cof.order_status} /> },
  ];

  return (
    <>
      <p className="text-sm text-foreground-soft md:text-ui">
        Portal orders become COFs the moment the client submits them. Pick one to review it beside the client's submission.
      </p>
      <DataList
        label="Portal orders to review"
        columns={columns}
        rows={query.data?.data}
        rowKey={(cof) => cof.id}
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={{ title: "No portal orders waiting", description: "New portal orders appear here as soon as clients submit them." }}
        onRowClick={open}
        onRowIntent={(cof) => void queryClient.prefetchQuery(cofQueryOptions(cof.id))}
        footer={query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      />
    </>
  );
}

function ManualCofForm({ messageId, clientId }: { messageId?: number; clientId?: number }) {
  const navigate = useNavigate();
  const user = useMeQuery().data;
  const isOnline = useOnlineStatus();
  const mutation = useCreateManualCofMutation();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [selectedMessage, setSelectedMessage] = useState(messageId ? String(messageId) : "");
  const [terms, setTerms] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<DraftCofLine[]>([]);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const prefillClient = useQuery({
    queryKey: salesCatalogKeys.client(clientId ?? 0),
    queryFn: () => getClient(clientId ?? 0),
    enabled: clientId !== undefined,
  });

  useEffect(() => {
    if (prefillClient.data && !client) {
      setClient(prefillClient.data);
    }
  }, [prefillClient.data, client]);

  const messages = useMessagesQuery({ status: "received", client_id: client?.id, per_page: 50 }, client !== null);
  const discounts = useStandingDiscountsQuery(client?.id ?? null);
  const serverErrors = getFieldErrors(mutation.error);
  const fieldErrors: Record<string, string> = { ...serverErrors, ...clientErrors };
  const lineErrors = Object.fromEntries(
    Object.entries(serverErrors)
      .map(([field, message]) => [Number(field.match(/^items\.(\d+)\./)?.[1]), message] as const)
      .filter(([index]) => Number.isInteger(index)),
  );

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!client) {
      errors.client_id = "Choose the client.";
    }
    if (!selectedMessage) {
      errors.incoming_message_id = "Choose the logged message this order came from. Log it first on Purchase Orders.";
    }
    if (lines.length === 0) {
      errors.items = "Add at least one item.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !client) {
      return;
    }
    return mutation.mutateAsync(
      {
        client_id: client.id,
        incoming_message_id: Number(selectedMessage),
        terms: terms.trim() || null,
        request_delivery_date: deliveryDate || null,
        remarks: remarks.trim() || null,
        items: linesPayload(lines),
      },
      {
        onSuccess: (cof) => {
          toast.success(`${cof.cof_number} created.`);
          void navigate({ to: "/sales/cofs/$cofId", params: { cofId: String(cof.id) }, replace: true });
        },
      },
    );
  }

  const canSave = hasPermission(user, COF_PERMISSIONS.create);
  const submitButton = (
    <LoadingButton
      type="submit"
      form="new-cof-form"
      disabled={!canSave || !isOnline}
      title={isOnline ? undefined : "Reconnect to save"}
      isPending={mutation.isPending}
      pendingText="Saving…"
    >
      Save COF
    </LoadingButton>
  );

  return (
    <SubmitForm id="new-cof-form" onSubmit={handleSubmit} className="border border-border bg-card px-4 pb-5 md:px-6">
      <FormError message={getGeneralError(mutation.error, [...FORM_FIELDS, ...Object.keys(serverErrors).filter((key) => key.startsWith("items."))])} />

      <SectionTitle>Client &amp; Source</SectionTitle>
      <div className="flex flex-col gap-4 md:gap-3.5">
        <FormField label="Client" htmlFor="cof-client" required error={fieldErrors.client_id}>
          <ClientCombobox
            id="cof-client"
            value={client}
            invalid={Boolean(fieldErrors.client_id)}
            onChange={(next) => {
              setClient(next);
              setSelectedMessage("");
              setClientErrors(({ client_id: _removed, ...rest }) => rest);
            }}
          />
        </FormField>
        <FormField
          label="Logged Message"
          htmlFor="cof-message"
          required
          hint="The message with the client's attachment. Saving is blocked without it."
          error={fieldErrors.incoming_message_id}
        >
          <SelectField
            value={selectedMessage}
            onChange={(value) => {
              setSelectedMessage(value);
              setClientErrors(({ incoming_message_id: _removed, ...rest }) => rest);
            }}
            placeholder={client ? (messages.data?.data.length ? "Choose a message" : "No unconverted messages for this client") : "Choose a client first"}
            triggerProps={{ ...fieldA11yProps("cof-message", fieldErrors.incoming_message_id, true), className: "w-full md:w-96" }}
            options={(messages.data?.data ?? []).map((message) => ({
              value: String(message.id),
              label: `${statusInfo(message.channel).label} · ${formatDateTime(message.received_at)} · ${message.attachment_name}`,
            }))}
          />
        </FormField>
      </div>

      <SectionTitle>Information</SectionTitle>
      <div className="flex flex-col gap-4 md:gap-3.5">
        <FormField label="Date" htmlFor="cof-date">
          <p className="py-1.5 text-sm md:text-ui">{formatDate(new Date())}</p>
        </FormField>
        <FormField label="Terms" htmlFor="cof-terms" hint="For example 30 Days or COD." error={fieldErrors.terms}>
          <Input
            {...fieldA11yProps("cof-terms", fieldErrors.terms, true)}
            className="text-base md:w-56 md:text-ui"
            maxLength={100}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
          />
        </FormField>
        <FormField label="Delivery Date" htmlFor="cof-delivery-date" error={fieldErrors.request_delivery_date}>
          <Input
            {...fieldA11yProps("cof-delivery-date", fieldErrors.request_delivery_date)}
            type="date"
            min={toIsoDate(new Date())}
            className="text-base md:w-56 md:text-ui"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
        </FormField>
        <FormField label="Remarks" htmlFor="cof-remarks" error={fieldErrors.remarks}>
          <Textarea
            {...fieldA11yProps("cof-remarks", fieldErrors.remarks)}
            rows={2}
            maxLength={2000}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </FormField>
      </div>

      <SectionTitle>Item Table</SectionTitle>
      {fieldErrors.items && <FormError message={fieldErrors.items} />}
      <CofLineEditor
        lines={lines}
        onChange={setLines}
        lineErrors={lineErrors}
        newLineDiscount={(itemId) => discounts.data?.get(itemId) ?? 0}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Prices come from Accounting. Discounts start from the client's standing discount and can be changed for this order only.
      </p>

      <div className="mt-6 hidden justify-end border-t border-border-subtle pt-4 md:flex">{submitButton}</div>
      <StickyActionBar>{submitButton}</StickyActionBar>
    </SubmitForm>
  );
}
