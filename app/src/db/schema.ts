import Dexie, { type EntityTable } from "dexie";
import { newIdempotencyKey } from "@/lib/offline/idempotencyKey";

export interface CachedItem {
  id: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedOrder {
  id: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedSession {
  id: string;
  data: unknown;
  cachedAt: number;
}

export type PendingMutationStatus = "pending" | "syncing" | "failed";

export interface PendingMutation {
  id: number;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  payload: unknown;
  idempotency_key: string;
  created_at: number;
  status: PendingMutationStatus;
  error_reason?: string;
  user_id: number;
  scope: string;
  line_id: number | null;
  quantity: number;
  label: string;
}

export class AppDatabase extends Dexie {
  cached_items!: EntityTable<CachedItem, "id">;
  cached_orders!: EntityTable<CachedOrder, "id">;
  cached_session!: EntityTable<CachedSession, "id">;
  pending_mutations!: EntityTable<PendingMutation, "id">;

  constructor() {
    super("mcvsync_app");

    this.version(1).stores({
      cached_items: "id, cachedAt",
      cached_orders: "id, cachedAt",
      pending_mutations: "++id, status, created_at",
    });

    this.version(2).stores({
      cached_session: "id",
      pending_mutations: "++id, status, created_at, scope, user_id",
    });

    this.version(3)
      .stores({})
      .upgrade((transaction) =>
        transaction
          .table<PendingMutation, number>("pending_mutations")
          .toCollection()
          .modify((mutation) => {
            mutation.idempotency_key ??= newIdempotencyKey();
          }),
      );
  }
}

export const db = new AppDatabase();
