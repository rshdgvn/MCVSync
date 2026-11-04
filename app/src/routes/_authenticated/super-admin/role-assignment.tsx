import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { FormError } from "@/components/FormError";
import { FormField } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/SelectField";
import { useAssignEmployeeRoleMutation, useEmployeesQuery } from "@/hooks/useStaff";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Employee } from "@/types/staff";
import { ROLE_LABELS, ROLES, type Role } from "@/types/user";

export const Route = createFileRoute("/_authenticated/super-admin/role-assignment")({
  beforeLoad: requireRole("super_admin"),
  component: RoleAssignmentPage,
});

const COLUMNS: DataListColumn<Employee>[] = [
  {
    key: "name",
    header: "Name",
    mobile: "title",
    cell: (employee) => <span className="font-medium">{employee.name}</span>,
  },
  {
    key: "email",
    header: "Email",
    mobile: "subtitle",
    cell: (employee) => <span className="text-muted-foreground">{employee.email}</span>,
  },
  { key: "position", header: "Position", cell: (employee) => employee.position },
  {
    key: "role",
    header: "Role",
    mobile: "badge",
    cell: (employee) =>
      employee.role ? (
        <StatusBadge status="role" tone="info" label={ROLE_LABELS[employee.role]} />
      ) : (
        <StatusBadge status="role" tone="warning" label="No Role" />
      ),
  },
];

function RoleAssignmentPage() {
  const employeesQuery = useEmployeesQuery();
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<Employee | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employeesQuery.data?.filter(
      (employee) =>
        !needle || employee.name.toLowerCase().includes(needle) || employee.email.toLowerCase().includes(needle),
    );
  }, [employeesQuery.data, search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Role Assignment"
        description="Choose which role each staff account holds, including Admin. Only the Super Admin can do this."
      />

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by name or email" />

      <DataList
        label="Staff roles"
        columns={COLUMNS}
        rows={rows}
        rowKey={(employee) => employee.id}
        isPending={employeesQuery.isPending}
        error={employeesQuery.error}
        onRetry={() => void employeesQuery.refetch()}
        empty={{ title: search ? "No staff match this search" : "No staff accounts yet" }}
        onRowClick={setAssigning}
        rowActions={(employee) => [{ label: "Change Role", icon: UserCog, onClick: () => setAssigning(employee) }]}
      />

      {assigning && <RoleDialog key={assigning.id} employee={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

interface RoleDialogProps {
  employee: Employee;
  onClose: () => void;
}

function RoleDialog({ employee, onClose }: RoleDialogProps) {
  const assignMutation = useAssignEmployeeRoleMutation();
  const [role, setRole] = useState<Role | "">(employee.role ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role) {
      return;
    }
    assignMutation.mutate(
      { employeeId: employee.id, role },
      {
        onSuccess: () => {
          toast.success(`${employee.name} is now ${ROLE_LABELS[role]}.`);
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !assignMutation.isPending && onClose()}
      title="Change Role"
      description={`${employee.name} · ${employee.email}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={assignMutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="role-form"
            disabled={!role || role === employee.role}
            isPending={assignMutation.isPending}
            pendingText="Saving…"
          >
            Save Role
          </LoadingButton>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={assignMutation.isError ? getErrorMessage(assignMutation.error) : null} />
        <FormField label="Role" htmlFor="employee-role" required>
          <SelectField
            value={role}
            onChange={(value) => setRole(value as Role | "")}
            placeholder="Select a role"
            triggerProps={{ id: "employee-role" }}
            options={ROLES.map((option) => ({ value: option, label: ROLE_LABELS[option] }))}
          />
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
