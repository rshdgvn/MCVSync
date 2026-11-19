import { useMutation } from "@tanstack/react-query";
import { downloadDocument } from "@/api/documents";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/stores/toast.store";

export interface DocumentFile {
  path: string;
  filename: string;
}

export function useDownloadDocumentMutation() {
  return useMutation({
    mutationFn: ({ path, filename }: DocumentFile) => downloadDocument(path, filename),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
