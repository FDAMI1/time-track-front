import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import PersonPicker from "@/tickets/components/PersonPicker";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import { personName, type NamedRef } from "@/tickets/lib/types";

function PeopleList({ people, onRemove }: { people: NamedRef[]; onRemove: (id: string) => void }) {
  if (!people.length) return <p className="text-muted-foreground">None</p>;
  return (
    <ul className="space-y-1">
      {people.map((p) => (
        <li key={p._id} className="flex items-center justify-between gap-2">
          <span className="truncate">{personName(p) || "Member"}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Remove ${personName(p)}`} onClick={() => onRemove(p._id)}><X className="w-3 h-3" /></Button>
        </li>
      ))}
    </ul>
  );
}

// CC and watchers. The server refuses a watcher who can't see the ticket, with its reason.
export default function PeopleCard({ controls }: { controls: TicketControls }) {
  const { data, action, update } = controls;
  if (!data) return null;
  const cc = data.ticket.cc || [];
  const watchers = data.ticket.watchers || [];
  return (
    <Card data-testid="card-people">
      <CardHeader className="pb-2"><CardTitle className="text-sm">CC and Watchers</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">CC</p>
          <PeopleList people={cc} onRemove={(id) => update.mutate({ cc: cc.map((p) => p._id).filter((c) => c !== id) })} />
          <PersonPicker label="Add to CC" testId="input-add-cc" onChange={(p) => p && update.mutate({ cc: [...cc.map((c) => c._id), p._id] })} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Watchers</p>
          <PeopleList people={watchers} onRemove={(id) => action.mutate({ path: `watchers/${id}`, method: "delete" })} />
          <PersonPicker label="Add a watcher" testId="input-add-watcher" onChange={(p) => p && action.mutate({ path: "watchers", payload: { userId: p._id } })} />
        </div>
      </CardContent>
    </Card>
  );
}
