import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";

// List, save and deactivate for one /api/tickets/settings collection.
export function useSettingsCrud<T extends { _id: string }>(name: string) {
  const api = useMcqApi();
  const { toast } = useToast();
  const url = `/api/tickets/settings/${name}`;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [url] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets/meta"] });
  };
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const list = useQuery({ queryKey: [url], queryFn: () => api.get<T[]>(url) });
  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) => (id ? api.put<T>(`${url}/${id}`, body) : api.post<T>(url, body)),
    onSuccess: () => { refresh(); toast({ title: "Saved" }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${url}/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Done" }); },
    onError,
  });

  return { list, save, remove };
}
