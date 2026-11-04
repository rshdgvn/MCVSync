import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierStatusDialog } from "@/components/suppliers/SupplierStatusDialog";
import { SUPPLIER_ROUTES, type SupplierSection } from "@/components/suppliers/supplierRoutes";
import { Button } from "@/components/ui/button";
import { supplierQueryOptions, useSuppliersQuery } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/supplier";

type StatusFilter = "all" | "active" | "inactive";

type DialogState = { mode: "create" } | { mode: "edit"; supplier: Supplier } | null;

const COLUMNS: DataListColumn<Supplier>[] = [
  {
    key: "name",
    header: "Name",
    mobile: "title",
    cell: (supplier) => <span className="font-medium">{supplier.name}</span>,
  },
  {
    key: "contact_person",
    header: "Contact Person",
    mobile: "subtitle",
    cell: (supplier) => supplier.contact_person ?? "—",
  },
  { key: "phone", header: "Contact #", cell: (supplier) => supplier.phone ?? "—" },
  {
    key: "email",
    header: "Email",
    cell: (supplier) => <span className="break-all text-muted-foreground">{supplier.email ?? "—"}</span>,
  },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (supplier) => <StatusBadge status={supplier.is_active ? "active" : "inactive"} />,
  },
];

interface SuppliersPageProps {
  section: SupplierSection;
}

export function SuppliersPage({ section }: SuppliersPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [statusTarget, setStatusTarget] = useState<Supplier | null>(null);

  const suppliersQuery = useSuppliersQuery({
    page,
    search: search || undefined,
    is_active: status === "all" ? undefined : status === "active",
  });
  const counts = suppliersQuery.data?.counts;

  function openSupplier(supplier: Supplier) {
    void navigate({ to: SUPPLIER_ROUTES[section].detail, params: { supplierId: String(supplier.id) } });
  }

  const addButton = (
    <Button onClick={() => setDialog({ mode: "create" })}>
      <Plus />
      Add New Supplier
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suppliers"
        description="Companies you buy stock from. Deactivate a supplier instead of deleting it so past Purchase Orders stay intact."
        primaryAction={addButton}
      />

      <FilterTabs
        ariaLabel="Filter suppliers by status"
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        tabs={[
          { value: "all", label: "All Suppliers", count: counts?.all },
          { value: "active", label: "Active", count: counts?.active },
          { value: "inactive", label: "Inactive", count: counts?.inactive },
        ]}
      />

      <FilterBar
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        searchPlaceholder="Search suppliers…"
      />

      <DataList
        label="Suppliers"
        columns={COLUMNS}
        rows={suppliersQuery.data?.data}
        rowKey={(supplier) => supplier.id}
        isPending={suppliersQuery.isPending}
        error={suppliersQuery.error}
        onRetry={() => void suppliersQuery.refetch()}
        isRefreshing={suppliersQuery.isFetching && suppliersQuery.isPlaceholderData}
        skeletonRows={8}
        empty={
          search || status !== "all"
            ? { title: "No suppliers found", description: "Try a different search or status." }
            : {
                title: "No suppliers yet",
                description: "Add the first supplier to start creating Purchase Orders.",
                action: addButton,
              }
        }
        onRowClick={openSupplier}
        onRowIntent={(supplier) => {
          queryClient.setQueryData(supplierQueryOptions(supplier.id).queryKey, (cached) => cached ?? supplier);
        }}
        rowActions={(supplier) => [
          { label: "View", icon: Eye, onClick: () => openSupplier(supplier) },
          { label: "Edit", icon: Pencil, onClick: () => setDialog({ mode: "edit", supplier }) },
          supplier.is_active
            ? { label: "Deactivate", icon: PowerOff, destructive: true, onClick: () => setStatusTarget(supplier) }
            : { label: "Activate", icon: Power, onClick: () => setStatusTarget(supplier) },
        ]}
        footer={suppliersQuery.data && <Pagination meta={suppliersQuery.data.meta} onPageChange={setPage} />}
      />

      {dialog && (
        <SupplierDialog
          key={dialog.mode === "edit" ? dialog.supplier.id : "create"}
          supplier={dialog.mode === "edit" ? dialog.supplier : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      <SupplierStatusDialog supplier={statusTarget} onClose={() => setStatusTarget(null)} />
    </div>
  );
}
