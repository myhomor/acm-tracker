import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentItem, DocumentKind } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useDocuments(projectId?: string) {
  return useQuery({
    queryKey: ["documents", { projectId: projectId ?? null }],
    queryFn: () => apiClient.get<DocumentItem[]>(`/documents${projectId ? `?projectId=${projectId}` : ""}`),
  });
}

export function useCreateDocument(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { kind: DocumentKind; title: string; phase?: string; url?: string; projectId?: string }) =>
      apiClient.post<DocumentItem>("/documents", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", { projectId: projectId ?? null }] }),
  });
}

export function useDeleteDocument(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del<void>(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", { projectId: projectId ?? null }] }),
  });
}
