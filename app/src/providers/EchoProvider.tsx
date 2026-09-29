import { createContext, useContext, useEffect, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { api } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import type { Role, User } from "@/types/user";

export type ReverbEcho = Echo<"reverb">;

const INVENTORY_ROLES: Role[] = ["purchasing", "admin", "super_admin"];

const EchoContext = createContext<ReverbEcho | null>(null);

export function useEcho(): ReverbEcho | null {
  return useContext(EchoContext);
}

function createEcho(): ReverbEcho {
  return new Echo<"reverb">({
    broadcaster: "reverb",
    Pusher,
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
    enabledTransports: ["ws", "wss"],
    channelAuthorization: {
      customHandler: ({ socketId, channelName }, callback) => {
        api
          .post<{ auth: string; channel_data?: string }>("/broadcasting/auth", {
            socket_id: socketId,
            channel_name: channelName,
          })
          .then((response) => callback(null, response.data))
          .catch((error) => callback(error, null));
      },
    },
  });
}

interface EchoProviderProps {
  user: User;
  children: React.ReactNode;
}

/**
 * Gated on the employee's role so Sales/Accounting/Logistics — who never
 * see inventory data — don't open a websocket connection they'll never use.
 * Created once per authenticated session at the app root rather than per
 * page, per INVENTORY_REALTIME_SPEC.
 */
export function EchoProvider({ user, children }: EchoProviderProps) {
  const [echo, setEcho] = useState<ReverbEcho | null>(null);

  useEffect(() => {
    if (!user.role || !INVENTORY_ROLES.includes(user.role)) {
      return;
    }

    const instance = createEcho();
    setEcho(instance);

    return () => {
      instance.disconnect();
      setEcho(null);
    };
  }, [user.role]);

  useEffect(() => {
    if (!echo) {
      return;
    }

    /**
     * Pusher-js fires both a "state_change" and a "connected" event for
     * the same transition, so onConnectionChange's callback runs twice
     * per connect — tracking the last distinct status (rather than a
     * one-shot "have we ever connected" flag) is what keeps that from
     * reading as a spurious reconnect on the very first connect.
     */
    let lastStatus: string | null = null;

    return echo.connector.onConnectionChange((status) => {
      if (status === "connected" && lastStatus !== null && lastStatus !== "connected") {
        invalidateStockRelatedQueries();
      }
      lastStatus = status;
    });
  }, [echo]);

  return <EchoContext.Provider value={echo}>{children}</EchoContext.Provider>;
}

/**
 * Any StockLevelChanged/LowStockThresholdCrossed events broadcast while
 * disconnected were simply missed — resubscribing alone doesn't replay
 * them, so a reconnect needs an explicit refetch to close that gap.
 */
function invalidateStockRelatedQueries() {
  queryClient.invalidateQueries({
    predicate: (query) =>
      (query.queryKey[0] === "inventory" &&
        query.queryKey[1] === "items" &&
        query.queryKey[3] === "stock") ||
      (query.queryKey[0] === "inventory" && query.queryKey[1] === "alerts" && query.queryKey[2] === "low-stock"),
  });
}
