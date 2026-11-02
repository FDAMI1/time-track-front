import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import type { TicketDetail } from "@/tickets/lib/types";

// One ticket with its data and the calls that change it. Every change refreshes the page and the queues.
export function useTicketDetail(id: string) {
  const api = useMcqApi();
  const { toast } = useToast();
  const url = `/api/tickets/${id}`;

  const query = useQuery({ queryKey: [url], queryFn: () => api.get<TicketDetail>(url), refetchInterval: 30000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [url] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets/reports/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets/reports/dashboard"] });
  };
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const action = useMutation({
    mutationFn: ({ path, payload, method = "post" }: { path: string; payload?: unknown; method?: "post" | "put" | "delete" }) =>
      (method === "delete" ? api.delete(`${url}/${path}`) : api[method](`${url}/${path}`, payload)),
    onSuccess: refresh,
    onError,
  });
  const update = useMutation({ mutationFn: (payload: unknown) => api.put(url, payload), onSuccess: refresh, onError });

  return { ...query, url, api, action, update, refresh, onError, toast };
}

export type TicketControls = ReturnType<typeof useTicketDetail>;
