import type { TicketEvent } from "@/tickets/lib/types";

// One line for timeline entries that aren't messages.
export function eventText(event: TicketEvent, statusLabel: (key: string) => string) {
  const meta = event.meta || {};
  switch (event.kind) {
    case "created": return "created this ticket";
    case "status": return `changed status to ${statusLabel(String(meta.to))}`;
    case "assignment": {
      if (meta.reason === "sla_breach") return "escalated this ticket after an SLA breach";
      const why = meta.transferReason ? ` (reason: ${String(meta.transferReason)})` : "";
      if (meta.fromName && meta.toName) return `transferred ownership from ${String(meta.fromName)} to ${String(meta.toName)}${why}`;
      if (meta.toName) return `assigned this ticket to ${String(meta.toName)}${why}`;
      return `changed the assignment${why}`;
    }
    case "update": return `updated ${Object.keys((meta.changes as object) || {}).join(", ") || "the ticket"}`;
    case "related": return `${meta.linked ? "linked" : "unlinked"} ${String(meta.ticketKey)}`;
    case "reopened": return "reopened this ticket";
    case "archived": return "archived this ticket";
    case "sla": return event.body || "SLA event";
    case "automation": return `automation ran: ${event.body}`;
    case "task": return `${String(meta.action)} task: ${event.body}`;
    case "time": return `${meta.removed ? "removed" : "logged"} ${String(meta.minutes)} minutes`;
    case "forward": return `forwarded this ticket to ${((meta.to as string[]) || []).join(", ")}`;
    case "scenario": return `ran scenario: ${event.body}`;
    default: return "";
  }
}
