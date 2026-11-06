import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

export interface HistoryItem { action: string; byName?: string; note?: string; at: string }
export interface TimeEntryRow {
  _id: string;
  date: string;
  taskName: string;
  description?: string;
  category?: string;
  projectId?: { _id: string; projectName: string } | string | null;
  startTime: string;
  endTime: string;
  duration: number;
  source?: "timer" | "manual";
  status?: "running" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  history?: HistoryItem[];
  userId?: { _id: string; firstName: string; lastName: string; role?: string } | string;
}

const TONES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  approved: "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};
const LABELS: Record<string, string> = { pending: "Pending approval", approved: "Approved", rejected: "Rejected" };
const ACTIONS: Record<string, string> = {
  started: "Timer started", stopped: "Timer stopped", submitted: "Submitted", edited: "Edited",
  resubmitted: "Sent for approval again", approved: "Approved", rejected: "Rejected",
};

// Entries saved before approvals existed have no status and count as approved.
export const statusOf = (entry: TimeEntryRow) => entry.status || "approved";

export function StatusBadge({ entry }: { entry: TimeEntryRow }) {
  const status = statusOf(entry);
  return (
    <span className="flex items-center gap-1 flex-wrap">
      <Badge variant="outline" className={`text-[11px] ${TONES[status] || ""}`} data-testid={`badge-status-${entry._id}`}>{LABELS[status] || status}</Badge>
      <Badge variant="secondary" className="text-[11px]">{entry.source === "timer" ? "Timer" : "Manual"}</Badge>
    </span>
  );
}

// Who did what to this entry, oldest first. The server writes it; nobody can edit it.
export function EntryHistory({ entry }: { entry: TimeEntryRow }) {
  const [open, setOpen] = useState(false);
  if (!entry.history?.length) return null;
  return (
    <div>
      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`button-history-${entry._id}`}>
        <History className="w-3 h-3 mr-1" />History
      </Button>
      {open && (
        <ol className="mt-1 space-y-0.5 border-l pl-3 text-xs text-muted-foreground" data-testid={`list-history-${entry._id}`}>
          {entry.history.map((h, i) => (
            <li key={i}>
              <span className="font-medium text-foreground">{ACTIONS[h.action] || h.action}</span>
              {h.byName ? ` by ${h.byName}` : ""} · {new Date(h.at).toLocaleString()}
              {h.note ? ` — ${h.note}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
