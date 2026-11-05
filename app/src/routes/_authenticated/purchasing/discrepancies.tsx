import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DiscrepancyList } from "@/components/discrepancies/DiscrepancyList";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { SelectField } from "@/components/SelectField";
import { useDiscrepanciesQuery } from "@/hooks/useDiscrepancies";
import { PURCHASE_ORDER_ROLES, requireRole } from "@/lib/rbac";
import { statusInfo } from "@/lib/status";
import type { DiscrepancyReferenceType, DiscrepancyType } from "@/types/discrepancy";

export const Route = createFileRoute("/_authenticated/purchasing/discrepancies")({
  beforeLoad: requireRole(...PURCHASE_ORDER_ROLES),
  component: DiscrepanciesPage,
});

type ResolutionFilter = "unresolved" | "resolved" | "all";

const ANY = "all";

const TYPES: DiscrepancyType[] = ["short", "over", "not_found"];

const DOCUMENT_TYPES: { value: DiscrepancyReferenceType; label: string }[] = [
  { value: "purchase_order", label: "Purchase Orders" },
  { value: "transfer_request", label: "Transfer Requests" },
];

function DiscrepanciesPage() {
  const [page, setPage] = useState(1);
  const [resolution, setResolution] = useState<ResolutionFilter>("unresolved");
  const [type, setType] = useState<DiscrepancyType | typeof ANY>(ANY);
  const [documentType, setDocumentType] = useState<DiscrepancyReferenceType | typeof ANY>(ANY);
  const query = useDiscrepanciesQuery({
    page,
    resolved: resolution === "all" ? undefined : resolution === "resolved",
    type: type === ANY ? undefined : type,
    reference_type: documentType === ANY ? undefined : documentType,
  });
  const counts = query.data?.counts;
  const filterCount = (type === ANY ? 0 : 1) + (documentType === ANY ? 0 : 1);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Discrepancies"
        description="Short, over and not-on-document items found while receiving. Resolve each one after following up."
      />

      <FilterTabs
        ariaLabel="Filter discrepancies by resolution"
        value={resolution}
        onChange={(next) => {
          setResolution(next);
          setPage(1);
        }}
        tabs={[
          { value: "unresolved", label: "Unresolved", count: counts?.unresolved },
          { value: "resolved", label: "Resolved", count: counts?.resolved },
          { value: "all", label: "All", count: counts?.all },
        ]}
      />

      <FilterBar
        activeFilterCount={filterCount}
        onClearFilters={() => {
          setType(ANY);
          setDocumentType(ANY);
          setPage(1);
        }}
      >
        <SelectField
          value={type}
          onChange={(value) => {
            setType((value || ANY) as DiscrepancyType | typeof ANY);
            setPage(1);
          }}
          placeholder="Type"
          triggerProps={{ className: "w-full md:w-48", "aria-label": "Discrepancy type" }}
          options={[{ value: ANY, label: "All Types" }, ...TYPES.map((value) => ({ value, label: statusInfo(value).label }))]}
        />
        <SelectField
          value={documentType}
          onChange={(value) => {
            setDocumentType((value || ANY) as DiscrepancyReferenceType | typeof ANY);
            setPage(1);
          }}
          placeholder="Document"
          triggerProps={{ className: "w-full md:w-48", "aria-label": "Document type" }}
          options={[{ value: ANY, label: "All Documents" }, ...DOCUMENT_TYPES]}
        />
      </FilterBar>

      <DiscrepancyList
        query={query}
        onPageChange={setPage}
        empty={
          resolution === "unresolved" && filterCount === 0
            ? { title: "No open discrepancies", description: "Everything received so far matches its document." }
            : { title: "No discrepancies found", description: "Try a different tab or filter." }
        }
      />
    </div>
  );
}
