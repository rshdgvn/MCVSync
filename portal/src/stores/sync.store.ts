import { create } from "zustand";

interface SyncState {
  lastServerTime: number | null;
  recordServerTime: (time: number) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastServerTime: null,
  recordServerTime: (time) => {
    const current = get().lastServerTime;
    if (current === null || time > current) {
      set({ lastServerTime: time });
    }
  },
}));
