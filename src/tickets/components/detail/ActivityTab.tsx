import { eventText } from "@/tickets/lib/events";
import type { TicketEvent } from "@/tickets/lib/types";

interface Props {
  events: TicketEvent[];
  statusLabel: (key: string) => string;
}

export default function ActivityTab({ events, statusLabel }: Props) {
  const text = (event: TicketEvent) => {
    if (event.kind === "comment") return "replied";
    if (event.kind === "note") return "added an internal note";
    return eventText(event, statusLabel);
  };
  return (
    <ol className="space-y-2 border-l pl-4" aria-label="Ticket activity" data-testid="list-activity">
      {[...events].reverse().map((event) => (
        <li key={event._id} className="text-sm">
          <span className="font-medium">{event.actorName}</span> {text(event)}
          <span className="block text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
