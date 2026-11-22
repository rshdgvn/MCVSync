import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as messagesApi from "@/api/incomingMessages";

export const messageKeys = {
  all: ["incoming-messages"] as const,
  list: (params: messagesApi.ListMessagesParams) => [...messageKeys.all, "list", params] as const,
};

export const PENDING_MESSAGES_PARAMS: messagesApi.ListMessagesParams = { status: "received", per_page: 1 };

export function useMessagesQuery(params: messagesApi.ListMessagesParams, enabled = true) {
  return useQuery({
    queryKey: messageKeys.list(params),
    queryFn: () => messagesApi.listMessages(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function useLogMessageMutation(onProgress: (percent: number) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: messagesApi.LogMessagePayload) => messagesApi.logMessage(payload, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageKeys.all }),
  });
}
