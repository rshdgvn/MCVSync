import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { Pencil, Power, PowerOff } from "lucide-react";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MicroLabel } from "@/components/MicroLabel";
import { StatusBadge } from "@/components/StatusBadge";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierStatusDialog } from "@/components/suppliers/SupplierStatusDialog";
import { SUPPLIER_ROUTES, type SupplierSection } from "@/components/suppliers/supplierRoutes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierQuery } from "@/hooks/useSuppliers";
import { getErrorMessage } from "@/lib/errors";
import type { Supplier } from "@/types/supplier";

const NOT_FOUND = 404;

interface SupplierDetailPageProps {
  section: SupplierSection;
  supplierId: number;
}

export function SupplierDetailPage({ section, supplierId }: SupplierDetailPageProps) {
  const supplierQuery = useSupplierQuery(supplierId);
  const [editing, setEditing] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Supplier | null>(null);
  const listPath = SUPPLIER_ROUTES[section].list;

  if (supplierQuery.isPending) {
    return <SupplierDetailSkeleton />;
  }

  if (supplierQuery.isError) {
    const notFound = isAxiosError(supplierQuery.error) && supplierQuery.error.response?.status === NOT_FOUND;
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader backTo={listPath} backLabel="Suppliers" title="Supplier" />
        <div className="border border-border bg-card">
          {notFound ? (
            <EmptyState
              title="Supplier not found"
              description="The link may be wrong. Go back to the supplier list to find it."
              action={
                <Button size="sm" variant="outline" render={<Link to={listPath} />}>
                  Back to Suppliers
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="This supplier couldn't be loaded"
              message={getErrorMessage(supplierQuery.error)}
              onRetry={() => void supplierQuery.refetch()}
            />
          )}
        </div>
      </div>
    );
  }

  const supplier = supplierQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <DetailHeader
          backTo={listPath}
          backLabel="Suppliers"
          eyebrow="Supplier"
          title={supplier.name}
          meta={<StatusBadge status={supplier.is_active ? "active" : "inactive"} />}
          primaryAction={
            <Button onClick={() => setEditing(true)}>
              <Pencil />
              Edit Supplier
            </Button>
          }
          overflowActions={[
            supplier.is_active
              ? { label: "Deactivate Supplier", icon: PowerOff, destructive: true, onSelect: () => setStatusTarget(supplier) }
              : { label: "Activate Supplier", icon: Power, onSelect: () => setStatusTarget(supplier) },
          ]}
        />
      </div>

      <section className="border border-border bg-card p-4 md:max-w-md">
        <MicroLabel className="mb-3">Supplier Info</MicroLabel>
        <dl className="grid gap-3">
          <SupplierField label="Contact Person">{supplier.contact_person}</SupplierField>
          <SupplierField label="Contact #">
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="text-primary hover:underline">
                {supplier.phone}
              </a>
            )}
          </SupplierField>
          <SupplierField label="Email">
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} className="break-all text-primary hover:underline">
                {supplier.email}
              </a>
            )}
          </SupplierField>
          <SupplierField label="Address">{supplier.address}</SupplierField>
        </dl>
      </section>

      {editing && <SupplierDialog supplier={supplier} onClose={() => setEditing(false)} />}
      <SupplierStatusDialog supplier={statusTarget} onClose={() => setStatusTarget(null)} />
    </div>
  );
}

function SupplierField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-micro font-bold tracking-[0.07em] text-faint uppercase">{label}</dt>
      <dd className="text-sm text-foreground md:text-ui">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function SupplierDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-7 w-64" />
      <div className="flex flex-col gap-3 border border-border bg-card p-4 md:max-w-md">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
