import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { capitalize, countdown, PRIORITY_CLASSES, type Ticket } from "@/tickets/lib/types";

// Priority and the two deadlines. A clock shows its time left only while it runs.
export default function StatusCard({ ticket }: { ticket: Ticket }) {
  const running = ["open", "pending"].includes(ticket.statusType) && !ticket.sla?.pausedAt;
  const clocks = [
    { label: "First response due", id: "sla-first-response", due: ticket.sla?.firstResponseDueAt, done: ticket.firstResponseAt ? "Responded" : "" },
    { label: "Resolution due", id: "sla-resolution", due: ticket.sla?.resolutionDueAt, done: "" },
  ];
  const stoppedText = ticket.sla?.pausedAt && ["open", "pending"].includes(ticket.statusType) ? "Paused" : "Stopped";

  return (
    <Card data-testid="card-ticket-status">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Priority</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>{capitalize(ticket.priority)}</span>
        </div>
        {clocks.map((clock) => {
          const left = countdown(clock.due);
          return (
            <div key={clock.label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{clock.label}</span>
              <span className={`text-right ${running && !clock.done && left?.overdue ? "text-destructive font-medium" : ""}`} data-testid={clock.id}>
                {!clock.due ? "No deadline" : clock.done || (running ? left?.text : stoppedText)}
                {clock.due && <span className="block text-xs text-muted-foreground font-normal">{new Date(clock.due).toLocaleString()}</span>}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
