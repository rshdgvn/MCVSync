import { isNetworkError } from "@/lib/errors";

interface CachedRow {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface OfflineCacheStore {
  get(key: string): PromiseLike<CachedRow | undefined>;
  put(row: CachedRow): PromiseLike<unknown>;
}

async function remember(store: OfflineCacheStore, key: string, data: unknown): Promise<void> {
  try {
    await store.put({ id: key, data, cachedAt: Date.now() });
  } catch {
    return;
  }
}

async function recall(store: OfflineCacheStore, key: string): Promise<CachedRow | undefined> {
  try {
    return await store.get(key);
  } catch {
    return undefined;
  }
}

export async function withOfflineCache<T>(store: OfflineCacheStore, key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    if (navigator.onLine) {
      await remember(store, key, data);
    }
    return data;
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }
    const cached = await recall(store, key);
    if (!cached) {
      throw error;
    }
    return cached.data as T;
  }
}
