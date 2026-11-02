import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { BUILT_IN_VIEWS } from "@/tickets/lib/views";
import type { TicketView } from "@/tickets/lib/types";

const URL = "/api/tickets/views";

interface Props {
  view: string;
  filters: Record<string, string>;
  canSave: boolean;
  onChoose: (key: string, filters: Record<string, string>) => void;
}

export default function ViewSwitcher({ view, filters, canSave, onChoose }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const { data: saved } = useQuery({ queryKey: [URL], queryFn: () => api.get<TicketView[]>(URL) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [URL] });
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: () => api.post<TicketView>(URL, { name, filters }),
    onSuccess: (created) => { refresh(); setNaming(false); setName(""); onChoose(created._id, created.filters); toast({ title: "View saved" }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${URL}/${id}`),
    onSuccess: () => { refresh(); onChoose("all", {}); toast({ title: "View deleted" }); },
    onError,
  });
  const mine = saved?.find((v) => v._id === view);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Select
        value={view}
        onValueChange={(key) => onChoose(key, BUILT_IN_VIEWS.find((v) => v.key === key)?.filters || saved?.find((v) => v._id === key)?.filters || {})}
      >
        <SelectTrigger className="w-full sm:w-64 font-medium" aria-label="Ticket view" data-testid="select-ticket-view"><SelectValue /></SelectTrigger>
        <SelectContent>
          {view === "custom" && <SelectItem value="custom">Custom filter</SelectItem>}
          <SelectGroup>
            {BUILT_IN_VIEWS.map((v) => <SelectItem key={v.key} value={v.key}>{v.name}</SelectItem>)}
          </SelectGroup>
          {!!saved?.length && (
            <SelectGroup>
              <SelectLabel>My views</SelectLabel>
              {saved.map((v) => <SelectItem key={v._id} value={v._id}>{v.name}</SelectItem>)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {canSave && <Button variant="outline" size="icon" className="shrink-0" aria-label="Save as a view" onClick={() => setNaming(true)} data-testid="button-save-view"><BookmarkPlus className="w-4 h-4" /></Button>}
      {mine && <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Delete ${mine.name}`} onClick={() => remove.mutate(mine._id)} data-testid="button-delete-view"><Trash2 className="w-4 h-4" /></Button>}

      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>Saves the current filters. Only you will see it.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input required maxLength={60} placeholder="View name" aria-label="View name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-view-name" />
            <Button type="submit" className="w-full" disabled={save.isPending} data-testid="button-confirm-view">Save View</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
