import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db, type PendingMutation } from "@/db/schema";

function useLiveQuery<T>(query: () => Promise<T>, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: () => setValue(fallback),
    });
    return () => subscription.unsubscribe();
  }, [query, fallback]);

  return value;
}

const countOpenMutations = () => db.pending_mutations.where("status").anyOf("pending", "failed").count();

const listFailedMutations = () =>
  db.pending_mutations.where("status").equals("failed").sortBy("created_at");

const NO_MUTATIONS: PendingMutation[] = [];

export function usePendingMutationCount(): number {
  return useLiveQuery(countOpenMutations, 0);
}

export function useFailedMutations(): PendingMutation[] {
  return useLiveQuery(listFailedMutations, NO_MUTATIONS);
}
