import { useState } from "react";
import { Pencil, Power, PowerOff } from "lucide-react";
import { DetailCard, DetailField } from "@/components/DetailFields";
import { DetailHeader } from "@/components/DetailHeader";
import { DetailLoadError } from "@/components/DetailLoadError";
import { StatusBadge } from "@/components/StatusBadge";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierPurchaseOrders } from "@/components/suppliers/SupplierPurchaseOrders";
import { SupplierStatusDialog } from "@/components/suppliers/SupplierStatusDialog";
import { SUPPLIER_ROUTES, type SupplierSection } from "@/components/suppliers/supplierRoutes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierQuery } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/supplier";

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
    return (
      <DetailLoadError
        error={supplierQuery.error}
        onRetry={() => void supplierQuery.refetch()}
        backTo={listPath}
        backLabel="Suppliers"
        entityLabel="Supplier"
      />
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

      <DetailCard title="Supplier Info" className="md:max-w-md">
        <DetailField label="Contact Person">{supplier.contact_person}</DetailField>
        <DetailField label="Contact #">
          {supplier.phone && (
            <a href={`tel:${supplier.phone}`} className="text-primary hover:underline">
              {supplier.phone}
            </a>
          )}
        </DetailField>
        <DetailField label="Email">
          {supplier.email && (
            <a href={`mailto:${supplier.email}`} className="break-all text-primary hover:underline">
              {supplier.email}
            </a>
          )}
        </DetailField>
        <DetailField label="Address">{supplier.address}</DetailField>
      </DetailCard>

      <SupplierPurchaseOrders supplier={supplier} section={section} />

      {editing && <SupplierDialog supplier={supplier} onClose={() => setEditing(false)} />}
      <SupplierStatusDialog supplier={statusTarget} onClose={() => setStatusTarget(null)} />
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
