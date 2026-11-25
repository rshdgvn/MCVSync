import { useCallback } from "react";
import { CloudUpload, WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db, type CachedOrder } from "@/db/schema";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatDateTime } from "@/lib/format";

interface StockFlowOfflineNoticeProps {
  cacheKey: string;
  unsynced: number;
}

function queuedText(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"} queued on this device`;
}

export function StockFlowOfflineNotice({ cacheKey, unsynced }: StockFlowOfflineNoticeProps) {
  const isOnline = useOnlineStatus();
  const readCachedRow = useCallback((): Promise<CachedOrder | null> => db.cached_orders.get(cacheKey).then((row) => row ?? null), [cacheKey]);
  const cached = useLiveQuery(readCachedRow, null);

  if (!isOnline) {
    return (
      <Alert variant="warning">
        <WifiOff />
        <AlertDescription>
          Offline.{" "}
          {cached ? `Showing this document as last loaded ${formatDateTime(cached.cachedAt)}.` : "Showing this document as last loaded."}{" "}
          Scans are saved on this device and sync when you reconnect.
          {unsynced > 0 && ` ${queuedText(unsynced)}.`}
        </AlertDescription>
      </Alert>
    );
  }

  if (unsynced > 0) {
    return (
      <Alert>
        <CloudUpload />
        <AlertDescription>Syncing: {queuedText(unsynced)}. Finish syncing before completing this document.</AlertDescription>
      </Alert>
    );
  }

  return null;
}
