import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  persistent?: boolean;
}

interface ToastOptions {
  action?: ToastAction;
  persistent?: boolean;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (toast: Omit<ToastMessage, "id">) => number;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 4000;

let nextToastId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (!toast.persistent) {
      window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

function showToast(tone: ToastTone, message: string, options: ToastOptions = {}): number {
  return useToastStore.getState().show({ tone, message, ...options });
}

export const toast = {
  success: (message: string, options?: ToastOptions) => showToast("success", message, options),
  error: (message: string, options?: ToastOptions) => showToast("error", message, options),
  info: (message: string, options?: ToastOptions) => showToast("info", message, options),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};
