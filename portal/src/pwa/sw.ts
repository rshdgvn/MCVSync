/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, type Strategy } from "workbox-strategies";
import { apiCacheName, classifyApiRequest, deleteApiCaches, type ApiCacheKind } from "./apiCachePolicy";
import { REFERENCE_API_PATHS } from "./referenceApiPaths";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

type ServiceWorkerMessage = { type: "SET_USER"; userId: string } | { type: "CLEAR_USER" } | { type: "SKIP_WAITING" };

const SESSION_CACHE = "mcvsync-session";
const SESSION_KEY = "/__mcvsync/session-user";
const LIVE_NETWORK_TIMEOUT_SECONDS = 3;
const SECONDS_PER_HOUR = 3600;

let currentUserId: string | null | undefined;
const strategies = new Map<string, Strategy>();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/sanctum\//],
  }),
);

registerRoute(
  ({ request }) => ["script", "style", "font", "image"].includes(request.destination),
  new CacheFirst({
    cacheName: "static-resources",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * SECONDS_PER_HOUR })],
  }),
);

function strategyFor(kind: ApiCacheKind, userId: string): Strategy {
  const cacheName = apiCacheName(kind, userId);
  const existing = strategies.get(cacheName);
  if (existing) {
    return existing;
  }

  const strategy =
    kind === "reference"
      ? new StaleWhileRevalidate({
          cacheName,
          plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * SECONDS_PER_HOUR })],
        })
      : new NetworkFirst({
          cacheName,
          networkTimeoutSeconds: LIVE_NETWORK_TIMEOUT_SECONDS,
          plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: SECONDS_PER_HOUR })],
        });

  strategies.set(cacheName, strategy);
  return strategy;
}

async function readUserId(): Promise<string | null> {
  if (currentUserId !== undefined) {
    return currentUserId;
  }
  const stored = await (await caches.open(SESSION_CACHE)).match(SESSION_KEY);
  currentUserId = stored ? await stored.text() : null;
  return currentUserId;
}

async function setUser(userId: string): Promise<void> {
  const previous = await readUserId();
  if (previous !== null && previous !== userId) {
    await deleteApiCaches(caches);
    strategies.clear();
  }
  currentUserId = userId;
  await (await caches.open(SESSION_CACHE)).put(SESSION_KEY, new Response(userId));
}

async function clearUser(): Promise<void> {
  currentUserId = null;
  strategies.clear();
  await deleteApiCaches(caches);
  await caches.delete(SESSION_CACHE);
}

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && classifyApiRequest(request.method, url.pathname, REFERENCE_API_PATHS) !== null,
  async ({ request, url, event }) => {
    const userId = await readUserId();
    const kind = classifyApiRequest(request.method, url.pathname, REFERENCE_API_PATHS);
    if (!userId || !kind) {
      return fetch(request);
    }
    return strategyFor(kind, userId).handle({ request, event });
  },
);

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const message = event.data as ServiceWorkerMessage | undefined;
  if (!message) {
    return;
  }
  if (message.type === "SKIP_WAITING") {
    void self.skipWaiting();
  } else if (message.type === "SET_USER") {
    event.waitUntil(setUser(message.userId));
  } else if (message.type === "CLEAR_USER") {
    event.waitUntil(clearUser());
  }
});
