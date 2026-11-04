import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { StickyActionBar } from "@/components/StickyActionBar";
import { TabBar } from "@/components/TabBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionsQuery, useRolesQuery, useUpdateRolePermissionsMutation } from "@/hooks/useStaff";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { toast } from "@/stores/toast.store";
import type { Permission } from "@/types/staff";
import { ROLE_LABELS, ROLES, type Role } from "@/types/user";

export const Route = createFileRoute("/_authenticated/admin/role-permissions")({
  beforeLoad: requireRole("admin"),
  component: RolePermissionsPage,
});

function RolePermissionsPage() {
  const rolesQuery = useRolesQuery();
  const permissionsQuery = usePermissionsQuery();
  const [role, setRole] = useState<Role>(ROLES[0]);
  const loadError = rolesQuery.error ?? permissionsQuery.error;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roles & Permissions"
        description="Choose which permissions each role includes. Changes take effect immediately."
      />

      <TabBar
        ariaLabel="Roles"
        value={role}
        onChange={setRole}
        tabs={ROLES.map((option) => ({ value: option, label: ROLE_LABELS[option] }))}
      />

      {(rolesQuery.isPending || permissionsQuery.isPending) && (
        <div className="grid gap-2 border border-border bg-card p-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
      )}

      {loadError && (
        <div className="border border-border bg-card">
          <ErrorState
            title="Roles and permissions couldn't be loaded"
            message={getErrorMessage(loadError)}
            onRetry={() => {
              void rolesQuery.refetch();
              void permissionsQuery.refetch();
            }}
          />
        </div>
      )}

      {rolesQuery.data && permissionsQuery.data && (
        <RolePermissionsPanel
          key={role}
          role={role}
          allPermissions={permissionsQuery.data}
          initialPermissionIds={
            rolesQuery.data.find((entry) => entry.name === role)?.permissions.map((permission) => permission.id) ?? []
          }
        />
      )}
    </div>
  );
}

interface RolePermissionsPanelProps {
  role: Role;
  allPermissions: Permission[];
  initialPermissionIds: number[];
}

function RolePermissionsPanel({ role, allPermissions, initialPermissionIds }: RolePermissionsPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialPermissionIds));
  const updateMutation = useUpdateRolePermissionsMutation();

  function toggle(permissionId: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }
      return next;
    });
  }

  function handleSave() {
    updateMutation.mutate(
      { role, permissionIds: Array.from(selected) },
      {
        onSuccess: () => toast.success(`${ROLE_LABELS[role]} permissions saved.`),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  }

  const saveButton = (
    <LoadingButton onClick={handleSave} isPending={updateMutation.isPending} pendingText="Saving…">
      Save Changes
    </LoadingButton>
  );

  if (allPermissions.length === 0) {
    return (
      <div className="border border-border bg-card">
        <EmptyState title="No permissions defined yet" />
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      <div className="grid gap-x-6 px-4 py-2 md:grid-cols-2 md:py-3">
        {allPermissions.map((permission) => (
          <label
            key={permission.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border-subtle text-sm text-foreground last:border-b-0 md:min-h-8 md:border-b-0 md:text-ui"
          >
            <Checkbox
              checked={selected.has(permission.id)}
              onCheckedChange={(checked) => toggle(permission.id, checked === true)}
            />
            <span className="font-mono text-xs">{permission.name}</span>
          </label>
        ))}
      </div>
      <div className="hidden justify-end border-t border-border-subtle px-4 py-3 md:flex">{saveButton}</div>
      <StickyActionBar>{saveButton}</StickyActionBar>
    </div>
  );
}
