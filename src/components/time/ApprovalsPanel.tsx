import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Inbox } from "lucide-react";
import { EntryHistory, StatusBadge, type TimeEntryRow } from "./EntryStatus";
import { formatTime12 } from "@/lib/utils";

type Status = "pending" | "approved" | "rejected";
const formatDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const personName = (u: TimeEntryRow["userId"]) => (u && typeof u === "object" ? `${u.firstName} ${u.lastName}`.trim() : "");

// Manual time from the people this manager supervises. Pending entries can be approved or
// rejected with a reason; the other tabs are the approval history.
export default function ApprovalsPanel({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const key = ["/api/timetracking/approvals", status, fromDate, toDate];
  const { data: entries, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<TimeEntryRow[]>(`/api/timetracking/approvals?status=${status}&startDate=${fromDate}&endDate=${toDate}`),
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/api/timetracking/${id}/${approve ? "approve" : "reject"}`, approve ? {} : { reason }),
    onSuccess: (_d, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/report"] });
      setRejecting(null);
      setReason("");
      toast({ title: approve ? "Approved" : "Rejected" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3" data-testid="approvals-panel">
      <div className="flex gap-1" role="tablist" aria-label="Approval status">
        {(["pending", "approved", "rejected"] as Status[]).map((s) => (
          <Button key={s} role="tab" aria-selected={status === s} size="sm" variant={status === s ? "secondary" : "outline"} onClick={() => setStatus(s)} data-testid={`button-approvals-${s}`}>
            {s === "pending" ? "Waiting" : s === "approved" ? "Approved" : "Rejected"}
          </Button>
        ))}
      </div>
      {isLoading && <Skeleton className="h-24 w-full" />}
      {!isLoading && !entries?.length && (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />No {status === "pending" ? "entries waiting for you" : `${status} entries`} in these dates</CardContent></Card>
      )}
      {entries?.map((e) => (
        <Card key={e._id} data-testid={`approval-${e._id}`}>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{personName(e.userId)} · <span className="text-muted-foreground font-normal">{e.date}</span></p>
                <p className="text-sm">{e.taskName}{e.category ? <span className="text-muted-foreground"> · {e.category}</span> : null}{e.projectId && typeof e.projectId === "object" ? <span className="text-muted-foreground"> · {e.projectId.projectName}</span> : null}</p>
                {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
              </div>
              <div className="text-sm sm:text-right shrink-0">
                <p>{formatTime12(e.startTime)} – {formatTime12(e.endTime)}</p>
                <p className="font-semibold">{formatDuration(e.duration)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusBadge entry={e} />
              {e.status === "pending" && rejecting !== e._id && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review.mutate({ id: e._id, approve: true })} disabled={review.isPending} data-testid={`button-approve-${e._id}`}><Check className="w-4 h-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejecting(e._id); setReason(""); }} data-testid={`button-reject-${e._id}`}><X className="w-4 h-4 mr-1" />Reject</Button>
                </div>
              )}
            </div>
            {rejecting === e._id && (
              <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (reason.trim()) review.mutate({ id: e._id, approve: false }); }}>
                <Input autoFocus placeholder="Reason for rejecting" aria-label="Reason for rejecting" value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} data-testid={`input-reject-reason-${e._id}`} />
                <Button type="submit" size="sm" variant="destructive" disabled={!reason.trim() || review.isPending} data-testid={`button-confirm-reject-${e._id}`}>Reject</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
              </form>
            )}
            {e.status === "rejected" && e.rejectionReason && <p className="text-xs text-destructive">Reason: {e.rejectionReason}</p>}
            <EntryHistory entry={e} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
