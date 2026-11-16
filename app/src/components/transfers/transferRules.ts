import { seesAllBranches } from "@/lib/rbac";
import type { TransferDetail, TransferSummary } from "@/types/transfer";
import type { User } from "@/types/user";

type TransferLike = Pick<TransferSummary, "status" | "requesting_branch" | "fulfilling_branch">;

function isOnSide(user: User, branchId: number): boolean {
  return seesAllBranches(user) || user.branch?.id === branchId;
}

export function canRequestTransfer(user: User): boolean {
  return seesAllBranches(user) || (user.branch !== null && !user.branch.is_main);
}

export function canFulfillTransfer(user: User, transfer: TransferLike): boolean {
  return transfer.status === "pending" && isOnSide(user, transfer.fulfilling_branch.id);
}

export function canReceiveTransfer(user: User, transfer: TransferLike): boolean {
  return transfer.status === "shipped" && isOnSide(user, transfer.requesting_branch.id);
}

export function canCancelTransfer(user: User, transfer: TransferDetail): boolean {
  return (
    transfer.status === "pending" &&
    isOnSide(user, transfer.requesting_branch.id) &&
    transfer.items.every((line) => line.quantity_picked === 0)
  );
}

export function isFullyPicked(transfer: TransferDetail): boolean {
  return transfer.items.every((line) => line.quantity_picked >= line.quantity_requested);
}
