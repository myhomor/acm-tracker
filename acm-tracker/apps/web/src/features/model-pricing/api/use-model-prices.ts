import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModelPrice } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useModelPrices() {
  return useQuery({
    queryKey: ["model-prices"],
    queryFn: () => apiClient.get<ModelPrice[]>("/model-prices"),
  });
}

export function useCreateModelPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { provider: string; model: string; inputPer1M: number; outputPer1M: number }) =>
      apiClient.post<ModelPrice>("/model-prices", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-prices"] }),
  });
}

export function useUpdateModelPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; provider?: string; model?: string; inputPer1M?: number; outputPer1M?: number }) =>
      apiClient.patch<ModelPrice>(`/model-prices/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-prices"] }),
  });
}

export function useDeleteModelPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del<void>(`/model-prices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-prices"] }),
  });
}
