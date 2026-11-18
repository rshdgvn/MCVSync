import { api } from "@/api/client";
import type {
  Discrepancy,
  DiscrepancyListResponse,
  DiscrepancyReferenceType,
  DiscrepancyResolution,
  DiscrepancyType,
} from "@/types/discrepancy";

export interface ListDiscrepanciesParams {
  page?: number;
  per_page?: number;
  resolved?: boolean;
  type?: DiscrepancyType;
  reference_type?: DiscrepancyReferenceType;
  reference_id?: number;
}

export async function listDiscrepancies(params: ListDiscrepanciesParams = {}): Promise<DiscrepancyListResponse> {
  const response = await api.get<DiscrepancyListResponse>("/staff/discrepancies", {
    params: { ...params, resolved: params.resolved === undefined ? undefined : Number(params.resolved) },
  });
  return response.data;
}

export function discrepancySubject(discrepancy: Pick<Discrepancy, "item" | "scanned_barcode">): string {
  if (discrepancy.item) {
    return discrepancy.item.name;
  }
  return discrepancy.scanned_barcode ? `Barcode ${discrepancy.scanned_barcode}` : "Unknown item";
}

export async function resolveDiscrepancy(
  id: number,
  resolution: DiscrepancyResolution,
  resolutionNote: string | null,
  itemId: number | null,
): Promise<Discrepancy> {
  const response = await api.post<Discrepancy>(`/staff/discrepancies/${id}/resolve`, {
    resolution,
    resolution_note: resolutionNote,
    item_id: itemId,
  });
  return response.data;
}
