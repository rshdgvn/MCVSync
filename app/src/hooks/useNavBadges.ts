import { PENDING_MESSAGES_PARAMS, useMessagesQuery } from "@/hooks/useIncomingMessages";
import type { Role } from "@/types/user";

export function useNavBadges(role: Role): Record<string, number> {
  const pendingMessages = useMessagesQuery(PENDING_MESSAGES_PARAMS, role === "sales");

  return {
    intakePending: pendingMessages.data?.meta.total ?? 0,
  };
}
