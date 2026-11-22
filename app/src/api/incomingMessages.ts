import { api } from "@/api/client";
import type { DocumentFile } from "@/hooks/useDocuments";
import type { Paginated } from "@/types/inventory";
import type { IncomingMessage, MessageChannel, MessageStatus } from "@/types/clientOrderForm";

export interface ListMessagesParams {
  page?: number;
  per_page?: number;
  status?: MessageStatus;
  client_id?: number;
}

export interface LogMessagePayload {
  client_id: number;
  channel: MessageChannel;
  attachment: File;
  received_at: string | null;
  notes: string | null;
}

const BASE_PATH = "/staff/incoming-messages";

export const MESSAGE_CHANNELS: readonly { value: MessageChannel; label: string }[] = [
  { value: "messenger", label: "Messenger" },
  { value: "viber", label: "Viber" },
  { value: "email", label: "Email" },
];

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export function messageStatusKey(status: MessageStatus): string {
  return status === "received" ? "message_received" : "converted";
}

export function attachmentDocument(message: Pick<IncomingMessage, "id" | "attachment_name">): DocumentFile {
  return { path: `${BASE_PATH}/${message.id}/attachment`, filename: message.attachment_name };
}

export async function listMessages(params: ListMessagesParams = {}): Promise<Paginated<IncomingMessage>> {
  const response = await api.get<Paginated<IncomingMessage>>(BASE_PATH, { params });
  return response.data;
}

export async function logMessage(payload: LogMessagePayload, onProgress: (percent: number) => void): Promise<IncomingMessage> {
  const form = new FormData();
  form.append("client_id", String(payload.client_id));
  form.append("channel", payload.channel);
  form.append("attachment", payload.attachment);
  if (payload.received_at) {
    form.append("received_at", payload.received_at);
  }
  if (payload.notes) {
    form.append("notes", payload.notes);
  }
  const response = await api.post<IncomingMessage>(BASE_PATH, form, {
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return response.data;
}
