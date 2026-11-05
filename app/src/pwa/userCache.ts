import { db } from "@/db/schema";
import { queryClient } from "@/lib/queryClient";
import { deleteApiCaches } from "@/pwa/apiCachePolicy";

const LAST_USER_KEY = "mcvsync:last-user";

function readLastUser(): string | null {
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

function writeLastUser(userId: string | null): void {
  try {
    if (userId === null) {
      window.localStorage.removeItem(LAST_USER_KEY);
    } else {
      window.localStorage.setItem(LAST_USER_KEY, userId);
    }
  } catch {
    return;
  }
}

async function postToServiceWorker(message: { type: "SET_USER"; userId: string } | { type: "CLEAR_USER" }) {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage(message);
}

async function clearCachedTables(): Promise<void> {
  await Promise.all([db.cached_items.clear(), db.cached_orders.clear()]);
}

export async function purgeUserData(): Promise<void> {
  writeLastUser(null);
  queryClient.clear();
  await Promise.all([
    "caches" in window ? deleteApiCaches(window.caches) : Promise.resolve([]),
    clearCachedTables(),
    postToServiceWorker({ type: "CLEAR_USER" }),
  ]);
}

export async function activateUserCache(userId: number): Promise<void> {
  const id = String(userId);
  const lastUser = readLastUser();

  if (lastUser !== null && lastUser !== id) {
    await Promise.all([
      "caches" in window ? deleteApiCaches(window.caches) : Promise.resolve([]),
      clearCachedTables(),
    ]);
  }

  writeLastUser(id);
  await postToServiceWorker({ type: "SET_USER", userId: id });
}
