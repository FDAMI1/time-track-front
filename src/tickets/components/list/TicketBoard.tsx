import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { capitalize, personName, PRIORITY_CLASSES, type Ticket, type TicketMeta } from "@/tickets/lib/types";

interface Props {
  tickets: Ticket[];
  meta: TicketMeta;
}

// Columns by status. A drag or the select posts to the normal status route, so
// transitions and closure rules are checked there, and a refused move shows its reason.
export default function TicketBoard({ tickets, meta }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [over, setOver] = useState("");

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.post(`/api/tickets/${id}/status`, { status }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }),
    onError: (err: Error) => toast({ title: "Can't move this ticket", description: err.message, variant: "destructive" }),
  });
  const shown = new Set(tickets.map((t) => t.status));
  const columns = meta.statuses.filter((s) => s.type !== "closed" || shown.has(s.key));

  return (
    <div className="flex flex-col md:flex-row gap-3 md:overflow-x-auto md:pb-2" data-testid="board-tickets">
      {columns.map((column) => {
        const cards = tickets.filter((t) => t.status === column.key);
        return (
          <section
            key={column.key}
            aria-label={column.label}
            className={`md:w-64 md:shrink-0 rounded-lg border bg-muted/30 p-2 space-y-2 ${over === column.key ? "ring-2 ring-primary" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(column.key); }}
            onDragLeave={() => setOver("")}
            onDrop={(e) => {
              e.preventDefault();
              setOver("");
              const id = e.dataTransfer.getData("text/plain");
              const ticket = tickets.find((t) => t._id === id);
              if (ticket && ticket.status !== column.key) move.mutate({ id, status: column.key });
            }}
            data-testid={`board-column-${column.key}`}
          >
            <h2 className="px-1 text-sm font-medium flex items-center justify-between">{column.label}<span className="text-xs text-muted-foreground">{cards.length}</span></h2>
            {cards.map((ticket) => (
              <article
                key={ticket._id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", ticket._id)}
                className="rounded-md border bg-card p-3 space-y-2 cursor-grab"
                data-testid={`board-card-${ticket.ticketKey}`}
              >
                <Link href={`/${ticket._id}`} className="block text-sm font-medium break-words hover:underline">{ticket.subject}</Link>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span className="font-mono">{ticket.ticketKey}</span>
                  <span className={`rounded px-1.5 py-0.5 font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>{capitalize(ticket.priority)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{personName(ticket.agentId) || "Unassigned"}</p>
                <Select value={ticket.status} onValueChange={(status) => move.mutate({ id: ticket._id, status })}>
                  <SelectTrigger className="h-8 text-xs" aria-label={`Move ${ticket.ticketKey}`} data-testid={`board-move-${ticket.ticketKey}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.statuses.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
