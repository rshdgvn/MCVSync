import { useEffect } from "react";
import { notify } from "@/lib/notifications";
import { replayPendingMutations } from "@/lib/offline/replay";

export function OfflineSync({ userId }: { userId: number }) {
  useEffect(() => {
    function handleOnline() {
      notify("back-online");
      void replayPendingMutations(userId);
    }

    function handleOffline() {
      notify("offline");
    }

    if (navigator.onLine) {
      void replayPendingMutations(userId);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userId]);

  return null;
}
