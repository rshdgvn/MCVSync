import { useEffect } from "react";
import { useEcho } from "@/providers/EchoProvider";
import { acquireInventoryChannel } from "@/lib/realtime/inventoryChannels";
import { useMeQuery } from "@/hooks/useAuth";

export function useInventoryChannels(branchIds: number[]): void {
  const echo = useEcho();
  const key = Array.from(new Set(branchIds)).sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!echo || !key) {
      return;
    }

    const releases = key.split(",").map((id) => acquireInventoryChannel(echo, Number(id)));
    return () => releases.forEach((release) => release());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo, key]);
}

/**
 * Purchasing is branch-scoped, so their own branch id from `/me` is the
 * one channel they ever need. Admin/Super Admin aren't scoped to a branch
 * and the Items List has no branch filter to key a subscription off, so
 * they're left out here — only Item Detail's Stock tab (which lists every
 * branch at once) gives them a concrete set of branches to subscribe to.
 */
export function usePurchasingOwnBranchIds(): number[] {
  const { data: user } = useMeQuery();
  if (user?.role === "purchasing" && user.branch) {
    return [user.branch.id];
  }
  return [];
}
