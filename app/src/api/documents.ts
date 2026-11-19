import { isAxiosError } from "axios";
import { api } from "@/api/client";

async function withJsonErrorBody(error: unknown): Promise<unknown> {
  if (!isAxiosError(error) || !(error.response?.data instanceof Blob)) {
    return error;
  }
  try {
    error.response.data = JSON.parse(await error.response.data.text());
  } catch {
    return error;
  }
  return error;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadDocument(path: string, filename: string): Promise<void> {
  try {
    const response = await api.get<Blob>(path, { responseType: "blob" });
    saveBlob(response.data, filename);
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
