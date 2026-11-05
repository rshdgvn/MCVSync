import { useEffect, useRef } from "react";
import { usePwaStore } from "@/stores/pwa.store";
import { useScanSessionStore } from "@/stores/scanSession.store";
import { toast } from "@/stores/toast.store";

export function UpdatePrompt() {
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const applyUpdate = usePwaStore((state) => state.applyUpdate);
  const isScanning = useScanSessionStore((state) => state.activeScanInputs > 0);
  const shownToastId = useRef<number | null>(null);

  useEffect(() => {
    if (!updateAvailable || !applyUpdate) {
      return;
    }

    if (isScanning) {
      if (shownToastId.current !== null) {
        toast.dismiss(shownToastId.current);
        shownToastId.current = null;
      }
      return;
    }

    if (shownToastId.current === null) {
      shownToastId.current = toast.info("Update available", {
        persistent: true,
        action: { label: "Reload", onAction: () => void applyUpdate() },
      });
    }
  }, [updateAvailable, applyUpdate, isScanning]);

  return null;
}
