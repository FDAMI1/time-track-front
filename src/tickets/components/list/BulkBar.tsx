import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { capitalize, personName, PRIORITIES, type TicketMeta } from "@/tickets/lib/types";

interface Props {
  meta: TicketMeta;
  selected: string[];
  onDone: () => void;
}

export default function BulkBar({ meta, selected, onDone }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const bulk = useMutation({
    mutationFn: (body: { action: string; value?: string }) =>
      api.post<{ results: { ok: boolean; message?: string }[] }>("/api/tickets/bulk", { ids: selected, ...body }),
    onSuccess: ({ results }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      onDone();
      const refused = results.filter((r) => !r.ok);
      const reason = refused[0]?.message;
      toast({
        title: `${results.length - refused.length} updated`,
        description: refused.length ? `${refused.length} could not be updated${reason ? `: ${reason}` : ""}` : undefined,
        variant: refused.length ? "destructive" : "default",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/50 p-3" data-testid="bar-bulk">
      <span className="text-sm font-medium">{selected.length} selected</span>
      <div className="w-44">
        <Select value="" onValueChange={(value) => bulk.mutate({ action: "status", value })}>
          <SelectTrigger aria-label="Set status" data-testid="bulk-status"><SelectValue placeholder="Set status" /></SelectTrigger>
          <SelectContent>{meta.statuses.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="w-44">
        <Select value="" onValueChange={(value) => bulk.mutate({ action: "priority", value })}>
          <SelectTrigger aria-label="Set priority"><SelectValue placeholder="Set priority" /></SelectTrigger>
          <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="w-44">
        <Select value="" onValueChange={(value) => bulk.mutate({ action: "assign_agent", value })}>
          <SelectTrigger aria-label="Assign agent"><SelectValue placeholder="Assign agent" /></SelectTrigger>
          <SelectContent>{meta.agents.map((a) => <SelectItem key={a._id} value={a._id}>{personName(a) || a.username}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {meta.isAdmin && <Button variant="outline" size="sm" onClick={() => bulk.mutate({ action: "archive" })}>Archive</Button>}
    </div>
  );
}
