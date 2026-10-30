import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { capitalize, PRIORITIES, SCALE, type StatusType, type TicketStatus } from "@/tickets/lib/types";

interface Config {
  statuses: TicketStatus[];
  matrixEnabled: boolean;
  priorityMatrix: Record<string, string>;
  requesterReplyStatus: string;
  closeRequiresChildrenClosed: boolean;
}

const URL = "/api/tickets/settings/config";

export default function GeneralSettings() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: [URL], queryFn: () => api.get<Config>(URL) });
  const [form, setForm] = useState<Config | null>(null);
  const [newStatus, setNewStatus] = useState({ label: "", type: "open" as StatusType });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<Config>) => api.put<Config>(URL, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [URL] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/meta"] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!form) return null;
  const setStatus = (index: number, change: Partial<TicketStatus>) =>
    setForm({ ...form, statuses: form.statuses.map((s, i) => (i === index ? { ...s, ...change } : s)) });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Statuses</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {form.statuses.map((status, i) => (
            <div key={status.key} className="flex items-center gap-3">
              <Input value={status.label} aria-label={`Name of ${status.key}`} onChange={(e) => setStatus(i, { label: e.target.value })} />
              <span className="text-xs text-muted-foreground w-20 shrink-0">{capitalize(status.type)}</span>
              <Switch checked={status.isActive !== false} aria-label={`${status.label} active`} onCheckedChange={(isActive) => setStatus(i, { isActive })} />
            </div>
          ))}
          <div className="flex items-center gap-3 flex-wrap">
            <Input className="flex-1 min-w-40" placeholder="New status name" value={newStatus.label} onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })} />
            <div className="w-32">
              <Select value={newStatus.type} onValueChange={(type) => setNewStatus({ ...newStatus, type: type as StatusType })}>
                <SelectTrigger aria-label="New status type"><SelectValue /></SelectTrigger>
                <SelectContent>{["open", "pending", "resolved", "closed"].map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              disabled={!newStatus.label.trim()}
              onClick={() => { save.mutate({ statuses: [...form.statuses, { ...newStatus, key: "" }] }); setNewStatus({ label: "", type: "open" }); }}
            >Add</Button>
          </div>
          <Button onClick={() => save.mutate({ statuses: form.statuses })} data-testid="button-save-statuses">Save Statuses</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Behaviour</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            Parent tickets must wait for child tickets before closing
            <Switch checked={form.closeRequiresChildrenClosed} onCheckedChange={(v) => setForm({ ...form, closeRequiresChildrenClosed: v })} />
          </label>
          <div className="space-y-2">
            <Label>When a requester replies to a pending ticket, move it to</Label>
            <Select value={form.requesterReplyStatus || "none"} onValueChange={(v) => setForm({ ...form, requesterReplyStatus: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Leave unchanged</SelectItem>
                {form.statuses.filter((s) => s.isActive !== false).map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => save.mutate({ closeRequiresChildrenClosed: form.closeRequiresChildrenClosed, requesterReplyStatus: form.requesterReplyStatus })}>Save Behaviour</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Priority Matrix</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            Work out priority from urgency and impact
            <Switch checked={form.matrixEnabled} onCheckedChange={(v) => setForm({ ...form, matrixEnabled: v })} data-testid="switch-priority-matrix" />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left font-medium text-muted-foreground">Urgency / Impact</th>
                  {SCALE.map((impact) => <th key={impact} className="p-2 text-left font-medium">{capitalize(impact)}</th>)}
                </tr>
              </thead>
              <tbody>
                {SCALE.map((urgency) => (
                  <tr key={urgency}>
                    <th className="p-2 text-left font-medium">{capitalize(urgency)}</th>
                    {SCALE.map((impact) => {
                      const key = `${urgency}_${impact}`;
                      return (
                        <td key={key} className="p-1 min-w-28">
                          <Select value={form.priorityMatrix[key]} onValueChange={(v) => setForm({ ...form, priorityMatrix: { ...form.priorityMatrix, [key]: v } })}>
                            <SelectTrigger aria-label={`Urgency ${urgency}, impact ${impact}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => save.mutate({ matrixEnabled: form.matrixEnabled, priorityMatrix: form.priorityMatrix })}>Save Matrix</Button>
        </CardContent>
      </Card>
    </div>
  );
}
