import type { User } from "@/types/user";

export const RESOLVE_DISCREPANCY_PERMISSION = "discrepancy.resolve";

export function canResolveDiscrepancies(user: User): boolean {
  return user.permissions.includes(RESOLVE_DISCREPANCY_PERMISSION);
}
