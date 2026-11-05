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
import { MessageCircle } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { useAuth } from "@/lib/auth";
import { CALL_OUTCOMES, ENQUIRY_SOURCES, ENQUIRY_STATUSES, STAGE_TONES, canUseAcademy, fillTemplate, labelOf, peopleOptions, stageOf, toOptions, type Enquiry, type EnquiryNote, type LeadTemplate, type Person } from "@/academy/lib/academy";
import { Picker, StatusBadge } from "@/academy/components/common";

interface Props {
  id: string;
  staff?: Person[];
  canAssign: boolean;
  onClose: () => void;
}

type Details = Pick<Enquiry, "name" | "phone" | "email" | "source">;

// One line above each timeline entry that isn't a plain note.
const entryLabel = (n: EnquiryNote) => ({ call: `Call: ${labelOf(n.outcome || "")}`, whatsapp: "WhatsApp message", status: "Status changed", assigned: "Assigned to", note: "" })[n.kind || "note"];

export default function EnquiryDialog({ id, staff, canAssign, onClose }: Props) {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [template, setTemplate] = useState("");
  const [message, setMessage] = useState("");
  const key = ["/api/enquiries", "detail", id];

  const { data: enquiry, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<Enquiry>(`/api/enquiries/${id}`) });
  const { data: templates } = useQuery({ queryKey: ["/api/enquiries", "templates"], queryFn: () => api.get<LeadTemplate[]>("/api/enquiries/templates") });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const update = useMutation({
    mutationFn: (body: Partial<Record<"status" | "assignedTo" | "nextFollowUpDate" | keyof Details, string>>) => api.put(`/api/enquiries/${id}`, body),
    onSuccess: () => { setDetails(null); refresh(); },
    onError: failed,
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/api/enquiries/${id}/notes`, outcome ? { body: note, kind: "call", outcome } : { body: note }),
    onSuccess: () => { setNote(""); setOutcome(""); refresh(); },
    onError: failed,
  });
  const whatsapp = useMutation({
    mutationFn: () => api.post<{ url: string }>(`/api/enquiries/${id}/whatsapp`, { body: message }),
    onSuccess: ({ url }) => { window.open(url, "_blank", "noopener"); setMessage(""); setTemplate(""); refresh(); },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/enquiries/${id}`),
    onSuccess: () => { refresh(); onClose(); },
    onError: failed,
  });
  const escalate = useMutation({
    mutationFn: () => api.post<{ ticket: { ticketKey: string } }>(`/api/enquiries/${id}/escalate`, {}),
    onSuccess: ({ ticket }) => { refresh(); toast({ title: `Ticket ${ticket.ticketKey} raised` }); },
    onError: failed,
  });

  const pickTemplate = (name: string) => {
    setTemplate(name);
    const chosen = templates?.find((t) => t.name === name);
    if (chosen && enquiry) {
      setMessage(fillTemplate(chosen.body, {
        name: enquiry.name, phone: enquiry.phone, course: enquiry.courseId?.title,
        org: (user?.organizationId as { name?: string } | null)?.name, agent: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
      }));
    }
  };
  const setDetail = (field: keyof Details, value: string) => setDetails((d) => (d ? { ...d, [field]: value } : d));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">{enquiry?.name || "Lead"}{enquiry && <StatusBadge status={enquiry.status} tone={STAGE_TONES[enquiry.stage || stageOf(enquiry.status)]} />}</DialogTitle>
          <DialogDescription>{enquiry ? [enquiry.phone, enquiry.email, enquiry.courseId?.title, labelOf(enquiry.source), enquiry.assignedTo ? `${enquiry.assignedTo.firstName} ${enquiry.assignedTo.lastName}` : "Unassigned"].filter(Boolean).join(" · ") : " "}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-48 w-full" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {enquiry && (
          <div className="space-y-4">
            {details ? (
              <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); update.mutate(details); }} data-testid="form-lead-details">
                <div className="space-y-1"><Label htmlFor="lead-name">Name</Label><Input id="lead-name" required maxLength={120} value={details.name} onChange={(e) => setDetail("name", e.target.value)} data-testid="input-lead-name" /></div>
                <div className="space-y-1"><Label htmlFor="lead-phone">Phone</Label><Input id="lead-phone" maxLength={40} value={details.phone} onChange={(e) => setDetail("phone", e.target.value)} data-testid="input-lead-phone" /></div>
                <div className="space-y-1"><Label htmlFor="lead-email">Email</Label><Input id="lead-email" type="email" value={details.email} onChange={(e) => setDetail("email", e.target.value)} data-testid="input-lead-email" /></div>
                <Picker label="Source" value={details.source} onChange={(v) => setDetail("source", v)} options={toOptions(ENQUIRY_SOURCES)} testId="select-lead-source" />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="sm" disabled={update.isPending} data-testid="button-save-lead">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDetails(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDetails({ name: enquiry.name, phone: enquiry.phone, email: enquiry.email, source: enquiry.source })} data-testid="button-edit-lead">Edit details</Button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Picker label="Status" value={enquiry.status} onChange={(status) => update.mutate({ status })} options={toOptions(ENQUIRY_STATUSES)} testId="select-enquiry-status" />
              {canAssign && <Picker label="Assigned to" value={enquiry.assignedTo?._id || ""} onChange={(assignedTo) => update.mutate({ assignedTo })} options={peopleOptions(staff)} testId="select-enquiry-reassign" />}
              <div className="space-y-1">
                <Label htmlFor="enquiry-next">Next follow-up</Label>
                <Input id="enquiry-next" type="date" value={enquiry.nextFollowUpDate} onChange={(e) => update.mutate({ nextFollowUpDate: e.target.value })} data-testid="input-enquiry-next" />
              </div>
            </div>

            {enquiry.phone && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium flex items-center gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</p>
                {templates && templates.length > 0 && <Picker label="Template" value={template} onChange={pickTemplate} options={templates.map((t) => ({ value: t.name, label: t.name }))} allLabel="Write your own" testId="select-whatsapp-template" />}
                <Textarea rows={3} maxLength={2000} placeholder="Message" aria-label="WhatsApp message" value={message} onChange={(e) => setMessage(e.target.value)} data-testid="input-whatsapp-message" />
                <Button size="sm" disabled={whatsapp.isPending || !message.trim()} onClick={() => whatsapp.mutate()} data-testid="button-send-whatsapp">Send on WhatsApp</Button>
              </div>
            )}

            <div className="space-y-2">
              {enquiry.campaign?.name && <p className="text-xs text-muted-foreground" data-testid="text-enquiry-campaign">Campaign: {[enquiry.campaign.name, enquiry.campaign.adSet, enquiry.campaign.ad].filter(Boolean).join(" / ")}</p>}
              <p className="text-sm font-medium">History</p>
              {(enquiry.notes || []).length === 0 && <p className="text-sm text-muted-foreground">No notes yet</p>}
              {[...(enquiry.notes || [])].reverse().map((n) => (
                <div key={n._id} className="rounded-lg bg-muted p-3 text-sm" data-testid={`note-${n.kind || "note"}`}>
                  {entryLabel(n) && <p className="text-xs font-medium">{entryLabel(n)}</p>}
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

            <div className="flex gap-2 flex-wrap border-t pt-4">
              {enquiry.ticketId ? (
                <Button asChild size="sm" variant="outline"><Link href={`/tickets/${enquiry.ticketId._id}`} data-testid="link-lead-ticket">Ticket {enquiry.ticketId.ticketKey}</Link></Button>
              ) : (
                <Button size="sm" variant="outline" disabled={escalate.isPending} onClick={() => escalate.mutate()} data-testid="button-escalate-lead">Raise Ticket</Button>
              )}
              {canAssign && canUseAcademy(user, "admissions") && !["completed", "converted"].includes(enquiry.status) && (
                <Button asChild size="sm" variant="outline"><Link href={`/admissions?enquiry=${enquiry._id}`} data-testid="link-start-application">Start Application</Link></Button>
              )}
              {canAssign && <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()} data-testid="button-delete-enquiry">Delete</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
