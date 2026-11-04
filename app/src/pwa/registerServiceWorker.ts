import { registerSW } from "virtual:pwa-register";
import { usePwaStore } from "@/stores/pwa.store";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePwaStore.getState().setUpdateAvailable(() => updateServiceWorker(true));
    },
  });
}
