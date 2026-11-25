import { useCallback, useMemo } from "react";
import { db, type PendingMutation } from "@/db/schema";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useMeQuery } from "@/hooks/useAuth";

const NO_MUTATIONS: PendingMutation[] = [];
const NO_USER = -1;

function useUserMutations(): PendingMutation[] {
  const userId = useMeQuery().data?.id ?? NO_USER;
  const listUserMutations = useCallback(
    () => db.pending_mutations.where("user_id").equals(userId).sortBy("created_at"),
    [userId],
  );
  return useLiveQuery(listUserMutations, NO_MUTATIONS);
}

export function usePendingMutationCount(): number {
  return useUserMutations().length;
}

export function useFailedMutations(): PendingMutation[] {
  return useUserMutations().filter((mutation) => mutation.status === "failed");
}

export interface ScopeQueue {
  unsynced: number;
  quantities: Map<number, number>;
}

export function useScopeQueue(scope: string): ScopeQueue {
  const mutations = useUserMutations();
  return useMemo(() => {
    const quantities = new Map<number, number>();
    let unsynced = 0;
    for (const mutation of mutations) {
      if (mutation.scope !== scope || mutation.status === "failed") {
        continue;
      }
      unsynced += 1;
      if (mutation.line_id !== null) {
        quantities.set(mutation.line_id, (quantities.get(mutation.line_id) ?? 0) + mutation.quantity);
      }
    }
    return { unsynced, quantities };
  }, [mutations, scope]);
}
