import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMcqApi } from "@/mcq/lib/api";
import { CALL_OUTCOMES, ENQUIRY_STATUSES, labelOf, peopleOptions, toOptions, type Enquiry, type Person } from "@/academy/lib/academy";
import { Picker } from "@/academy/components/common";

interface Props {
  id: string;
  staff?: Person[];
  canAssign: boolean;
  onClose: () => void;
}

export default function EnquiryDialog({ id, staff, canAssign, onClose }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const key = ["/api/enquiries", "detail", id];

  const { data: enquiry, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<Enquiry>(`/api/enquiries/${id}`) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const update = useMutation({
    mutationFn: (body: Partial<Record<"status" | "assignedTo" | "nextFollowUpDate", string>>) => api.put(`/api/enquiries/${id}`, body),
    onSuccess: refresh,
    onError: failed,
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/api/enquiries/${id}/notes`, outcome ? { body: note, kind: "call", outcome } : { body: note }),
    onSuccess: () => { setNote(""); setOutcome(""); refresh(); },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/enquiries/${id}`),
    onSuccess: () => { refresh(); onClose(); },
    onError: failed,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{enquiry?.name || "Enquiry"}</DialogTitle>
          <DialogDescription>{enquiry ? [enquiry.phone, enquiry.email, enquiry.courseId?.title, labelOf(enquiry.source)].filter(Boolean).join(" · ") : " "}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-48 w-full" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {enquiry && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Picker label="Status" value={enquiry.status} onChange={(status) => update.mutate({ status })} options={toOptions(ENQUIRY_STATUSES)} testId="select-enquiry-status" />
              {canAssign && <Picker label="Assigned to" value={enquiry.assignedTo?._id || ""} onChange={(assignedTo) => update.mutate({ assignedTo })} options={peopleOptions(staff)} testId="select-enquiry-reassign" />}
              <div className="space-y-1">
                <Label htmlFor="enquiry-next">Next follow-up</Label>
                <Input id="enquiry-next" type="date" value={enquiry.nextFollowUpDate} onChange={(e) => update.mutate({ nextFollowUpDate: e.target.value })} data-testid="input-enquiry-next" />
              </div>
            </div>

            <div className="space-y-2">
              {enquiry.campaign?.name && <p className="text-xs text-muted-foreground" data-testid="text-enquiry-campaign">Campaign: {[enquiry.campaign.name, enquiry.campaign.adSet, enquiry.campaign.ad].filter(Boolean).join(" / ")}</p>}
              <p className="text-sm font-medium">Notes and calls</p>
              {(enquiry.notes || []).length === 0 && <p className="text-sm text-muted-foreground">No notes yet</p>}
              {(enquiry.notes || []).map((n) => (
                <div key={n._id} className="rounded-lg bg-muted p-3 text-sm">
                  {n.kind === "call" && <p className="text-xs font-medium">Call: {labelOf(n.outcome || "")}</p>}
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); addNote.mutate(); }}>
                <Textarea rows={2} required maxLength={2000} placeholder="Add a note" aria-label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-enquiry-add-note" />
                <Picker label="Logging a call? Choose the outcome" value={outcome} onChange={setOutcome} options={toOptions(CALL_OUTCOMES)} allLabel="Not a call" testId="select-call-outcome" />
                <Button type="submit" size="sm" disabled={addNote.isPending} data-testid="button-add-note">{outcome ? "Log Call" : "Add Note"}</Button>
              </form>
            </div>

            {canAssign && (
              <div className="flex gap-2 flex-wrap border-t pt-4">
                {enquiry.status !== "converted" && (
                  <Button asChild size="sm" variant="outline"><Link href={`/admissions?enquiry=${enquiry._id}`} data-testid="link-start-application">Start Application</Link></Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()} data-testid="button-delete-enquiry">Delete</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
