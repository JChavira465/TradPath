"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrgUser } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useOrgUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<OrgUser[]>("/users")).data,
  });
}
