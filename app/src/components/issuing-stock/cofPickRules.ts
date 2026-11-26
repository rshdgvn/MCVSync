import { seesAllBranches } from "@/lib/rbac";
import type { CofFulfillment } from "@/types/clientOrderForm";
import type { User } from "@/types/user";

export const PICK_AGING_WARN_DAYS = 2;
export const PICK_AGING_DANGER_DAYS = 4;

type PickableCof = Pick<CofFulfillment, "order_status" | "branch" | "cancellation_requested" | "picking_completed_at">;

function isPickingPaused(cof: PickableCof): boolean {
  return cof.cancellation_requested || cof.picking_completed_at !== null;
}

export function canPickCof(user: User, cof: PickableCof): boolean {
  return cof.order_status === "processing" && !isPickingPaused(cof) && (seesAllBranches(user) || user.branch?.id === cof.branch?.id);
}

export function waitingSince(cof: Pick<CofFulfillment, "forwarded_at" | "created_at">): string | null {
  return cof.forwarded_at ?? cof.created_at;
}
