import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { nameOf, type Person } from "@/academy/lib/academy";

interface Rotation { enabled: boolean; members: (Person & { canTakeLeads: boolean })[]; next: string | null }
const KEY = "/api/lead-rotation";

// Round-robin: new leads nobody picked (added by hand, imported, or from a lead source with
// no default person) go to these people in turn.
export default function LeadRotationCard() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: [KEY], queryFn: () => api.get<Rotation>(KEY) });
  const { data: staff } = useQuery({ queryKey: ["/api/enquiries/staff"], queryFn: () => api.get<Person[]>("/api/enquiries/staff") });
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => { if (data) setChosen(data.members.map((m) => m._id)); }, [data]);

  const save = useMutation({
    mutationFn: (body: { enabled?: boolean; members?: string[] }) => api.put<Rotation>(KEY, body),
    onSuccess: (next) => { queryClient.setQueryData([KEY], next); toast({ title: "Lead assignment saved" }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });
  if (!data) return null;
  const dirty = JSON.stringify(chosen) !== JSON.stringify(data.members.map((m) => m._id));
  const toggle = (id: string, on: boolean) => setChosen(on ? [...chosen, id] : chosen.filter((x) => x !== id));

  return (
    <div className="space-y-3 border-t pt-4" data-testid="lead-rotation">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="rotation-enabled">Round-robin assignment</Label>
          <p className="text-xs text-muted-foreground">New leads with nobody chosen go to these people in turn.</p>
        </div>
        <Switch id="rotation-enabled" checked={data.enabled} disabled={save.isPending || (!data.enabled && !data.members.length)} onCheckedChange={(enabled) => save.mutate({ enabled })} data-testid="switch-rotation" />
      </div>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {(staff || []).map((p) => {
          const member = data.members.find((m) => m._id === p._id);
          return (
            <li key={p._id} className="flex items-center gap-2 text-sm">
              <Checkbox id={`rotation-${p._id}`} checked={chosen.includes(p._id)} onCheckedChange={(on) => toggle(p._id, !!on)} data-testid={`checkbox-rotation-${p._id}`} />
              <label htmlFor={`rotation-${p._id}`} className="flex-1">{nameOf(p)} <span className="text-xs text-muted-foreground capitalize">{p.role}</span></label>
              {member && !member.canTakeLeads && <Badge variant="outline" className="text-[10px]">no CRM access</Badge>}
              {data.enabled && data.next === p._id && <Badge variant="secondary" className="text-[10px]">next</Badge>}
            </li>
          );
        })}
      </ul>
      <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ members: chosen })} data-testid="button-save-rotation">Save people</Button>
    </div>
  );
}
