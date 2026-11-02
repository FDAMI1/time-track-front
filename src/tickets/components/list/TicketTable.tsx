import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp } from "lucide-react";
import { capitalize, personName, PRIORITY_CLASSES, ticketState, type Ticket, type TicketMeta } from "@/tickets/lib/types";

export interface Sort {
  key: string;
  order: "asc" | "desc";
}

const COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "requester", label: "Requester" },
  { key: "state", label: "State" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "agent", label: "Assigned to" },
];

interface Props {
  tickets: Ticket[];
  meta?: TicketMeta;
  sort?: Sort;
  onSort?: (key: string) => void;
  selected?: string[];
  onSelect?: (selected: string[]) => void;
}

// A table from tablet width up; on a phone each ticket is a stacked row.
export default function TicketTable({ tickets, meta, sort, onSort, selected, onSelect }: Props) {
  const statusLabel = (key: string) => meta?.statuses.find((s) => s.key === key)?.label || key;
  const assignee = (t: Ticket) => personName(t.agentId) || t.groupId?.name || "Unassigned";
  const toggle = (id: string, on: boolean) => onSelect?.(on ? [...(selected || []), id] : (selected || []).filter((s) => s !== id));
  const allSelected = tickets.length > 0 && tickets.every((t) => selected?.includes(t._id));

  const priority = (t: Ticket) => <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[t.priority]}`}>{capitalize(t.priority)}</span>;
  const state = (t: Ticket) => {
    const value = ticketState(t);
    return <span className={`text-xs ${value.className}`}>{value.label}</span>;
  };
  const subject = (t: Ticket) => (
    <>
      <Link href={`/${t._id}`} className="block font-medium break-words hover:underline" data-testid={`link-ticket-${t.ticketKey}`}>{t.subject}</Link>
      <span className="text-xs font-mono text-muted-foreground">{t.ticketKey}</span>
    </>
  );

  return (
    <>
      <div className="hidden md:block rounded-lg border bg-card" data-testid="table-tickets">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {onSelect && (
                <th className="w-10 p-3">
                  <Checkbox checked={allSelected} onCheckedChange={(checked) => onSelect(checked ? tickets.map((t) => t._id) : [])} aria-label="Select all tickets" />
                </th>
              )}
              {COLUMNS.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th key={column.key} className={`p-3 text-left font-medium text-muted-foreground ${column.key === "subject" ? "w-1/3" : ""}`} aria-sort={active ? (sort?.order === "asc" ? "ascending" : "descending") : undefined}>
                    {onSort ? (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(column.key)} data-testid={`sort-${column.key}`}>
                        {column.label}
                        {active && (sort?.order === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    ) : column.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket._id} className="border-b last:border-0 hover:bg-accent/40" data-testid={`row-ticket-${ticket.ticketKey}`}>
                {onSelect && (
                  <td className="p-3">
                    <Checkbox checked={selected?.includes(ticket._id)} onCheckedChange={(checked) => toggle(ticket._id, !!checked)} aria-label={`Select ${ticket.ticketKey}`} />
                  </td>
                )}
                <td className="p-3">{subject(ticket)}</td>
                <td className="p-3 break-words">{ticket.requesterName}</td>
                <td className="p-3">{state(ticket)}</td>
                <td className="p-3"><Badge variant="secondary">{statusLabel(ticket.status)}</Badge></td>
                <td className="p-3">{priority(ticket)}</td>
                <td className="p-3 break-words">{assignee(ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2" data-testid="list-tickets-stacked">
        {tickets.map((ticket) => (
          <li key={ticket._id} className="rounded-lg border bg-card p-3 space-y-2" data-testid={`stacked-ticket-${ticket.ticketKey}`}>
            <div className="flex items-start gap-3">
              {onSelect && <Checkbox className="mt-1" checked={selected?.includes(ticket._id)} onCheckedChange={(checked) => toggle(ticket._id, !!checked)} aria-label={`Select ${ticket.ticketKey}`} />}
              <div className="min-w-0 flex-1">{subject(ticket)}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {state(ticket)}
              <Badge variant="secondary">{statusLabel(ticket.status)}</Badge>
              {priority(ticket)}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              <dt className="text-muted-foreground">Requester</dt><dd className="break-words">{ticket.requesterName}</dd>
              <dt className="text-muted-foreground">Assigned to</dt><dd className="break-words">{assignee(ticket)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
