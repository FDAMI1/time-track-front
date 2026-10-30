import { useQuery } from "@tanstack/react-query";
import { useMcqApi } from "@/mcq/lib/api";
import type { TicketMeta } from "@/tickets/lib/types";

export function useTicketMeta() {
  const api = useMcqApi();
  return useQuery({ queryKey: ["/api/tickets/meta"], queryFn: () => api.get<TicketMeta>("/api/tickets/meta") });
}
