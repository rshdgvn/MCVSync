import { create } from "zustand";

interface PwaState {
  updateAvailable: boolean;
  applyUpdate: (() => Promise<void>) | null;
  setUpdateAvailable: (applyUpdate: () => Promise<void>) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  updateAvailable: false,
  applyUpdate: null,
  setUpdateAvailable: (applyUpdate) => set({ updateAvailable: true, applyUpdate }),
}));
