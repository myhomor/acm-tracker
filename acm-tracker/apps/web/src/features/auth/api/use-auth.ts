import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface AuthedUser {
  memberId: string;
  name: string;
  email: string;
  role: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (email: string) => apiClient.post<AuthedUser>("/auth/login", { email }),
  });
}
