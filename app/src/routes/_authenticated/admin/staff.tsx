import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CheckCircle2, Pencil, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataList, type DataListColumn } from "@/components/DataList";
import { FilterBar } from "@/components/FilterBar";
import { FilterTabs } from "@/components/FilterTabs";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/SelectField";
import {
  useActivateEmployeeMutation,
  useBranchesQuery,
  useCreateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useEmployeesQuery,
  useUpdateEmployeeMutation,
} from "@/hooks/useStaff";
import { getErrorMessage, getFieldErrors, getGeneralError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Employee } from "@/types/staff";
import { ROLE_LABELS } from "@/types/user";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  beforeLoad: requireRole("admin", "super_admin"),
  component: StaffAccountsPage,
});

type StatusFilter = "all" | "active" | "inactive";
type DialogState = { mode: "create" } | { mode: "edit"; employee: Employee } | null;

const NO_BRANCH = "none";

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
  { key: "role", header: "Role", cell: (employee) => (employee.role ? ROLE_LABELS[employee.role] : "None") },
  { key: "branch", header: "Branch", cell: (employee) => employee.branch?.name ?? "All branches" },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (employee) => <StatusBadge status={employee.is_active ? "active" : "inactive"} />,
  },
];

function matchesSearch(employee: Employee, search: string): boolean {
  const needle = search.trim().toLowerCase();
  return !needle || employee.name.toLowerCase().includes(needle) || employee.email.toLowerCase().includes(needle);
}

function StaffAccountsPage() {
  const employeesQuery = useEmployeesQuery();
  const deactivateMutation = useDeactivateEmployeeMutation();
  const activateMutation = useActivateEmployeeMutation();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);

  const searched = useMemo(
    () => employeesQuery.data?.filter((employee) => matchesSearch(employee, search)),
    [employeesQuery.data, search],
  );

  const counts = useMemo(() => {
    const rows = searched ?? [];
    const active = rows.filter((employee) => employee.is_active).length;
    return { all: rows.length, active, inactive: rows.length - active };
  }, [searched]);

  const rows = useMemo(
    () =>
      searched?.filter((employee) => (status === "all" ? true : employee.is_active === (status === "active"))),
    [searched, status],
  );

  function activate(employee: Employee) {
    activateMutation.mutate(employee.id, {
      onSuccess: () => toast.success(`${employee.name} can sign in again.`),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  function confirmDeactivate() {
    if (!deactivating) {
      return;
    }
    deactivateMutation.mutate(deactivating.id, {
      onSuccess: () => {
        toast.success(`${deactivating.name} was deactivated.`);
        setDeactivating(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Staff Accounts"
        description="Create, edit, and deactivate staff accounts. Role assignment is the Super Admin's authority."
        primaryAction={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            Add Staff
          </Button>
        }
      />

      <FilterTabs
        ariaLabel="Filter staff by status"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: "all", label: "All Staff", count: employeesQuery.data ? counts.all : undefined },
          { value: "active", label: "Active", count: employeesQuery.data ? counts.active : undefined },
          { value: "inactive", label: "Inactive", count: employeesQuery.data ? counts.inactive : undefined },
        ]}
      />

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by name or email" />

      <DataList
        label="Staff accounts"
        columns={COLUMNS}
        rows={rows}
        rowKey={(employee) => employee.id}
        isPending={employeesQuery.isPending}
        error={employeesQuery.error}
        onRetry={() => void employeesQuery.refetch()}
        empty={{
          title: search ? "No staff match this search" : "No staff accounts here",
          description: search ? "Try a different name or email." : "Add a staff account to get started.",
        }}
        rowActions={(employee) => [
          { label: "Edit", icon: Pencil, onClick: () => setDialog({ mode: "edit", employee }) },
          employee.is_active
            ? {
                label: "Deactivate",
                icon: Ban,
                destructive: true,
                onClick: () => {
                  deactivateMutation.reset();
                  setDeactivating(employee);
                },
              }
            : {
                label: "Activate",
                icon: CheckCircle2,
                disabled: activateMutation.isPending && activateMutation.variables === employee.id,
                onClick: () => activate(employee),
              },
        ]}
      />

      {dialog && (
        <EmployeeDialog
          key={dialog.mode === "edit" ? dialog.employee.id : "create"}
          employee={dialog.mode === "edit" ? dialog.employee : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate Staff Account?"
        description={
          <>
            <span className="font-semibold">{deactivating?.name}</span> will be signed out and can't sign in until the
            account is activated again. Their history is kept.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        isPending={deactivateMutation.isPending}
        error={deactivateMutation.isError ? getErrorMessage(deactivateMutation.error) : null}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}

interface EmployeeDialogProps {
  employee?: Employee;
  onClose: () => void;
}

function EmployeeDialog({ employee, onClose }: EmployeeDialogProps) {
  const branchesQuery = useBranchesQuery();
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [branchId, setBranchId] = useState(employee?.branch ? String(employee.branch.id) : NO_BRANCH);
  const mutation = employee ? updateMutation : createMutation;
  const fieldErrors = getFieldErrors(mutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const branch_id = branchId === NO_BRANCH ? null : Number(branchId);
    const onSuccess = () => {
      toast.success(employee ? "Staff account updated." : `${name} added.`);
      onClose();
    };

    if (employee) {
      updateMutation.mutate({ id: employee.id, payload: { name, email, position, branch_id } }, { onSuccess });
    } else {
      createMutation.mutate({ name, email, password, position, branch_id }, { onSuccess });
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title={employee ? "Edit Staff Account" : "Add Staff Account"}
      description="A branch is required for Sales, Purchasing, Accounting, and Logistics staff."
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="employee-form" isPending={mutation.isPending} pendingText="Saving…">
            {employee ? "Save Changes" : "Add Staff"}
          </LoadingButton>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 md:gap-3.5">
        <FormError message={getGeneralError(mutation.error)} />

        <FormField label="Full Name" htmlFor="employee-name" required error={fieldErrors.name}>
          <Input
            {...fieldA11yProps("employee-name", fieldErrors.name)}
            autoFocus
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField label="Email" htmlFor="employee-email" required error={fieldErrors.email}>
          <Input
            {...fieldA11yProps("employee-email", fieldErrors.email)}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField label="Position" htmlFor="employee-position" required error={fieldErrors.position}>
          <Input
            {...fieldA11yProps("employee-position", fieldErrors.position)}
            required
            placeholder="e.g. Purchasing Manager"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </FormField>

        {!employee && (
          <FormField
            label="Temporary Password"
            htmlFor="employee-password"
            required
            hint="At least 8 characters. Share it privately; the employee can reset it after signing in."
            error={fieldErrors.password}
          >
            <Input
              {...fieldA11yProps("employee-password", fieldErrors.password, true)}
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
        )}

        <FormField label="Branch" htmlFor="employee-branch" error={fieldErrors.branch_id}>
          <SelectField
            value={branchId}
            onChange={(value) => setBranchId(value || NO_BRANCH)}
            placeholder="Select a branch"
            triggerProps={fieldA11yProps("employee-branch", fieldErrors.branch_id)}
            options={[
              { value: NO_BRANCH, label: "No branch (Admin and Super Admin)" },
              ...(branchesQuery.data ?? []).map((branch) => ({ value: String(branch.id), label: branch.name })),
            ]}
          />
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
