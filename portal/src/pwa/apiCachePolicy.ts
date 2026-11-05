export type ApiCacheKind = "reference" | "live";

export const API_CACHE_PREFIX = "api-";

const NEVER_CACHED_PATHS: RegExp[] = [/\/auth\//, /\/me$/, /^\/sanctum\//, /\/broadcasting\//];

export interface CacheStorageLike {
  keys(): Promise<string[]>;
  delete(cacheName: string): Promise<boolean>;
}

export function classifyApiRequest(
  method: string,
  pathname: string,
  referencePaths: RegExp[],
): ApiCacheKind | null {
  if (method.toUpperCase() !== "GET" || !pathname.startsWith("/api/")) {
    return null;
  }
  if (NEVER_CACHED_PATHS.some((pattern) => pattern.test(pathname))) {
    return null;
  }
  return referencePaths.some((pattern) => pattern.test(pathname)) ? "reference" : "live";
}

export function apiCacheName(kind: ApiCacheKind, userId: string | number): string {
  return `${API_CACHE_PREFIX}${kind === "reference" ? "ref" : "live"}-${userId}`;
}

export function isApiCacheName(cacheName: string): boolean {
  return cacheName.startsWith(API_CACHE_PREFIX);
}

export async function deleteApiCaches(storage: CacheStorageLike): Promise<string[]> {
  const names = (await storage.keys()).filter(isApiCacheName);
  await Promise.all(names.map((name) => storage.delete(name)));
  return names;
}
