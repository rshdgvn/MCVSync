import { api } from "@/api/client";
import type {
  Discrepancy,
  DiscrepancyListResponse,
  DiscrepancyReferenceType,
  DiscrepancyType,
} from "@/types/discrepancy";

export interface ListDiscrepanciesParams {
  page?: number;
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

export async function resolveDiscrepancy(id: number, resolutionNote: string | null): Promise<Discrepancy> {
  const response = await api.post<Discrepancy>(`/staff/discrepancies/${id}/resolve`, {
    resolution_note: resolutionNote,
  });
  return response.data;
}
