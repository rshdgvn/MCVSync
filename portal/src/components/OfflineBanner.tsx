import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatDateTime } from "@/lib/format";
import { useSyncStore } from "@/stores/sync.store";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const lastServerTime = useSyncStore((state) => state.lastServerTime);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning-muted px-4 py-2 text-center text-sm font-medium text-warning md:text-xs"
    >
      <WifiOff className="size-4 shrink-0 md:size-3.5" />
      {lastServerTime
        ? `Offline — showing data from ${formatDateTime(lastServerTime)}`
        : "Offline — reconnect to load the latest data"}
    </div>
  );
}
