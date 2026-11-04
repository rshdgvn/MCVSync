import { create } from "zustand";

interface ScanSessionState {
  activeScanInputs: number;
  enter: () => void;
  leave: () => void;
}

export const useScanSessionStore = create<ScanSessionState>((set) => ({
  activeScanInputs: 0,
  enter: () => set((state) => ({ activeScanInputs: state.activeScanInputs + 1 })),
  leave: () => set((state) => ({ activeScanInputs: Math.max(0, state.activeScanInputs - 1) })),
}));
