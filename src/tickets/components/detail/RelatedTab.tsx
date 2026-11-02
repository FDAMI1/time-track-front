import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import type { TicketLink, TicketList } from "@/tickets/lib/types";

export default function RelatedTab({ controls }: { controls: TicketControls }) {
  const { data, url, api, action, update, refresh, onError } = controls;
  const [key, setKey] = useState("");

  const find = async () => {
    const found = await api.get<TicketList>(`/api/tickets?q=${encodeURIComponent(key.trim())}&limit=1`);
    if (!found.tickets[0]) throw new Error("Ticket not found");
    return found.tickets[0]._id;
  };
  const link = useMutation({
    mutationFn: async (kind: "related" | "parent") => {
      const id = await find();
      return kind === "related" ? api.post(`${url}/related`, { ticketId: id }) : api.put(url, { parentId: id });
    },
    onSuccess: () => { setKey(""); refresh(); },
    onError,
  });
  if (!data) return null;
  const { ticket, children, permissions } = data;
  const manage = permissions.manage;

  const row = (t: TicketLink, remove?: () => void) => (
    <li key={t._id} className="flex items-center justify-between gap-2">
      <Link href={`/${t._id}`} className="truncate hover:underline">{t.ticketKey}: {t.subject}</Link>
      {manage && remove && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Remove ${t.ticketKey}`} onClick={remove}><X className="w-3 h-3" /></Button>}
    </li>
  );
  const parent = ticket.parentId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Parent ticket</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {parent ? <ul>{row(parent, () => update.mutate({ parentId: null }))}</ul> : <p className="text-muted-foreground">None</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Child tickets</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {children.length ? <ul className="space-y-1">{children.map((c) => row(c))}</ul> : <p className="text-muted-foreground">None</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Related tickets</CardTitle></CardHeader>
        <CardContent className="text-sm" data-testid="list-related">
          {ticket.relatedIds?.length
            ? <ul className="space-y-1">{ticket.relatedIds.map((r) => row(r, () => action.mutate({ path: `related/${r._id}`, method: "delete" })))}</ul>
            : <p className="text-muted-foreground">None</p>}
        </CardContent>
      </Card>
      {manage && (
        <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); link.mutate("related"); }}>
          <Input className="flex-1 min-w-40" placeholder="TKT-000123" aria-label="Ticket number to link" value={key} onChange={(e) => setKey(e.target.value)} data-testid="input-related-key" />
          <Button type="submit" variant="outline" disabled={!key.trim() || link.isPending} data-testid="button-link-related">Link</Button>
          <Button type="button" variant="outline" disabled={!key.trim() || link.isPending} onClick={() => link.mutate("parent")} data-testid="button-set-parent">Make parent</Button>
        </form>
      )}
    </div>
  );
}
