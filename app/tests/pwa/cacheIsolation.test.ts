import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiCacheName,
  classifyApiRequest,
  deleteApiCaches,
  isApiCacheName,
} from "../../src/pwa/apiCachePolicy.ts";
import { REFERENCE_API_PATHS } from "../../src/pwa/referenceApiPaths.ts";

class FakeCache {
  private readonly entries = new Map<string, string>();

  async put(url: string, body: string): Promise<void> {
    this.entries.set(url, body);
  }

  async match(url: string): Promise<string | undefined> {
    return this.entries.get(url);
  }
}

class FakeCacheStorage {
  private readonly caches = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.caches.get(name);
    if (existing) {
      return existing;
    }
    const cache = new FakeCache();
    this.caches.set(name, cache);
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

const ITEMS_URL = "/api/staff/inventory/items?page=1";
const ITEMS_PATH = "/api/staff/inventory/items";

async function cachedResponseFor(storage: FakeCacheStorage, userId: number, pathname: string, url: string) {
  const kind = classifyApiRequest("GET", pathname, REFERENCE_API_PATHS);
  assert.ok(kind);
  return (await storage.open(apiCacheName(kind, userId))).match(url);
}

describe("cache isolation across users on one browser", () => {
  it("user B never sees user A's cached response after logout and login", async () => {
    const storage = new FakeCacheStorage();
    const userA = 1;
    const userB = 2;

    const kind = classifyApiRequest("GET", ITEMS_PATH, REFERENCE_API_PATHS);
    assert.equal(kind, "live");
    await (await storage.open(apiCacheName("live", userA))).put(ITEMS_URL, "items visible to user A");
    assert.equal(await cachedResponseFor(storage, userA, ITEMS_PATH, ITEMS_URL), "items visible to user A");

    const purged = await deleteApiCaches(storage);
    assert.deepEqual(purged, ["api-live-1"]);
    assert.deepEqual((await storage.keys()).filter(isApiCacheName), []);

    assert.equal(await cachedResponseFor(storage, userB, ITEMS_PATH, ITEMS_URL), undefined);
  });

  it("a user switch without logout still cannot read the previous user's cache", async () => {
    const storage = new FakeCacheStorage();
    await (await storage.open(apiCacheName("reference", 1))).put("/api/staff/inventory/categories", "A categories");

    assert.notEqual(apiCacheName("reference", 1), apiCacheName("reference", 2));
    const forUserB = await cachedResponseFor(storage, 2, "/api/staff/inventory/categories", "/api/staff/inventory/categories");
    assert.equal(forUserB, undefined);
  });

  it("purging leaves non-API caches alone", async () => {
    const storage = new FakeCacheStorage();
    await storage.open("static-resources");
    await storage.open(apiCacheName("live", 7));

    await deleteApiCaches(storage);

    assert.deepEqual(await storage.keys(), ["static-resources"]);
  });
});

describe("what may be cached", () => {
  it("never caches auth, /me, csrf, broadcasting, or mutations", () => {
    assert.equal(classifyApiRequest("GET", "/api/staff/auth/me", REFERENCE_API_PATHS), null);
    assert.equal(classifyApiRequest("POST", "/api/staff/auth/login", REFERENCE_API_PATHS), null);
    assert.equal(classifyApiRequest("GET", "/sanctum/csrf-cookie", REFERENCE_API_PATHS), null);
    assert.equal(classifyApiRequest("POST", "/api/broadcasting/auth", REFERENCE_API_PATHS), null);
    assert.equal(classifyApiRequest("PATCH", "/api/staff/inventory/items/1", REFERENCE_API_PATHS), null);
    assert.equal(classifyApiRequest("DELETE", "/api/staff/inventory/units/1", REFERENCE_API_PATHS), null);
  });

  it("uses stale-while-revalidate for reference data and network-first for live data", () => {
    assert.equal(classifyApiRequest("GET", "/api/staff/inventory/categories", REFERENCE_API_PATHS), "reference");
    assert.equal(classifyApiRequest("GET", "/api/staff/branches", REFERENCE_API_PATHS), "reference");
    assert.equal(classifyApiRequest("GET", "/api/staff/inventory/items/5/stock", REFERENCE_API_PATHS), "live");
  });

  it("names every API cache after its user", () => {
    assert.equal(apiCacheName("reference", 3), "api-ref-3");
    assert.equal(apiCacheName("live", 3), "api-live-3");
  });
});
