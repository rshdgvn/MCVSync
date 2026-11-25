import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

export function useLiveQuery<T>(query: () => Promise<T>, fallback: T): T {
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
