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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { useAuth } from "@/lib/auth";
import { CALL_OUTCOMES, ENQUIRY_SOURCES, ENQUIRY_STATUSES, STAGE_TONES, canUseAcademy, fillTemplate, labelOf, peopleOptions, stageOf, toOptions, type Enquiry, type EnquiryNote, type LeadTemplate, type NoteKind, type Person } from "@/academy/lib/academy";
import LeadEntries from "@/academy/components/LeadEntries";
import { Picker, StatusBadge } from "@/academy/components/common";

interface Props {
  id: string;
  staff?: Person[];
  canAssign: boolean;
  onClose: () => void;
}

type Details = Pick<Enquiry, "name" | "phone" | "email" | "source">;

const TABS = ["details", "notes", "calls", "discussions", "followups", "status", "timeline"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = { details: "Details", notes: "Notes", calls: "Call Logs", discussions: "Discussions", followups: "Follow-ups", status: "Status History", timeline: "Timeline" };
type Written = "note" | "call" | "discussion";

export default function EnquiryDialog({ id, staff, canAssign, onClose }: Props) {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [texts, setTexts] = useState<Record<Written, string>>({ note: "", call: "", discussion: "" });
  const [outcome, setOutcome] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [template, setTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const key = ["/api/enquiries", "detail", id];

  const { data: enquiry, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<Enquiry>(`/api/enquiries/${id}`) });
  const { data: templates } = useQuery({ queryKey: ["/api/enquiries", "templates"], queryFn: () => api.get<LeadTemplate[]>("/api/enquiries/templates") });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const update = useMutation({
    mutationFn: (body: Partial<Record<"status" | "assignedTo" | "transferReason" | "nextFollowUpDate" | keyof Details, string>>) => api.put(`/api/enquiries/${id}`, body),
    onSuccess: (_data, body) => {
      setDetails(null);
      refresh();
      if (body.assignedTo === undefined) return;
      setTransferReason("");
      // A telecaller who hands a lead on can no longer open it.
      if (["teacher", "employee"].includes(user?.role || "") && body.assignedTo !== user?._id) {
        toast({ title: "Lead transferred", description: "It has left your inbox." });
        onClose();
      }
    },
    onError: failed,
  });
  const addNote = useMutation({
    mutationFn: (kind: Written) => api.post(`/api/enquiries/${id}/notes`, kind === "call" ? { body: texts.call, kind, outcome } : { body: texts[kind], kind }),
    onSuccess: (_data, kind) => { setTexts((t) => ({ ...t, [kind]: "" })); if (kind === "call") setOutcome(""); refresh(); },
    onError: failed,
  });
  const editNote = (noteId: string, body: string) =>
    api.put(`/api/enquiries/${id}/notes/${noteId}`, { body }).then(refresh).catch((err: Error) => { failed(err); throw err; });
  const canEdit = (n: EnquiryNote) => ["org_admin", "manager"].includes(user?.role || "") || n.authorId === user?._id;
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

  const stage = enquiry ? enquiry.stage || stageOf(enquiry.status) : "cold";
  const entries = (kinds: NoteKind[] | undefined, empty: string) => (
    <LeadEntries notes={enquiry?.notes || []} kinds={kinds} empty={empty} canEdit={canEdit} onEdit={editNote} />
  );
  const writeBox = (kind: "note" | "discussion", placeholder: string, button: string) => (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); addNote.mutate(kind); }}>
      <Textarea rows={2} required maxLength={2000} placeholder={placeholder} aria-label={placeholder} value={texts[kind]} onChange={(e) => setTexts((t) => ({ ...t, [kind]: e.target.value }))} data-testid={`input-add-${kind}`} />
      <Button type="submit" size="sm" disabled={addNote.isPending || !texts[kind].trim()} data-testid={`button-add-${kind}`}>{button}</Button>
    </form>
  );
  const followUp = (testId: string) => (
    <div className="space-y-1">
      <Label htmlFor={testId}>Next follow-up</Label>
      <Input id={testId} type="date" value={enquiry?.nextFollowUpDate || ""} onChange={(e) => update.mutate({ nextFollowUpDate: e.target.value })} data-testid={testId} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">{enquiry?.name || "Lead"}{enquiry && <StatusBadge status={enquiry.status} tone={STAGE_TONES[stage]} />}</DialogTitle>
          <DialogDescription>{enquiry ? [enquiry.phone, enquiry.email, enquiry.courseId?.title, labelOf(enquiry.source), enquiry.assignedTo ? `${enquiry.assignedTo.firstName} ${enquiry.assignedTo.lastName}` : "Unassigned"].filter(Boolean).join(" · ") : " "}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-48 w-full" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {enquiry && (
          <div className="space-y-4">
            <Tabs defaultValue="details">
              <TabsList className="h-auto flex-wrap justify-start">
                {TABS.map((tab) => <TabsTrigger key={tab} value={tab} data-testid={`tab-lead-${tab}`}>{TAB_LABELS[tab]}</TabsTrigger>)}
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {details ? (
                  <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); update.mutate(details); }} data-testid="form-lead-details">
                    <div className="space-y-1"><Label htmlFor="lead-name">Name</Label><Input id="lead-name" required maxLength={120} value={details.name} onChange={(e) => setDetail("name", e.target.value)} data-testid="input-lead-name" /></div>
                    <div className="space-y-1"><Label htmlFor="lead-phone">Mobile number</Label><Input id="lead-phone" type="tel" maxLength={40} value={details.phone} onChange={(e) => setDetail("phone", e.target.value)} data-testid="input-lead-phone" /></div>
                    <div className="space-y-1"><Label htmlFor="lead-email">Email</Label><Input id="lead-email" type="email" value={details.email} onChange={(e) => setDetail("email", e.target.value)} data-testid="input-lead-email" /></div>
                    <Picker label="Source" value={details.source} onChange={(v) => setDetail("source", v)} options={toOptions(ENQUIRY_SOURCES)} testId="select-lead-source" />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" size="sm" disabled={update.isPending} data-testid="button-save-lead">Save</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDetails(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-lg border p-3 space-y-3">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" data-testid="lead-details">
                      {[["Name", enquiry.name], ["Mobile number", enquiry.phone], ["Email", enquiry.email], ["Source", labelOf(enquiry.source)], ["Course", enquiry.courseId?.title], ["Stage", labelOf(stage)]].map(([label, value]) => (
                        <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value || "-"}</dd></div>
                      ))}
                    </dl>
                    <Button size="sm" variant="outline" onClick={() => setDetails({ name: enquiry.name, phone: enquiry.phone, email: enquiry.email, source: enquiry.source })} data-testid="button-edit-lead">Edit details</Button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Picker label="Status" value={enquiry.status} onChange={(status) => update.mutate({ status })} options={toOptions(ENQUIRY_STATUSES)} testId="select-enquiry-status" />
                  {canAssign && (
                    <div className="space-y-2">
                      <Picker label="Owner" value={enquiry.assignedTo?._id || ""} onChange={(assignedTo) => update.mutate({ assignedTo, transferReason: transferReason.trim() })} options={peopleOptions(staff)} testId="select-enquiry-reassign" />
                      <Input aria-label="Reason for transfer (optional)" placeholder="Reason for transfer (optional, fill in before choosing)" maxLength={500} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} data-testid="input-lead-transfer-reason" />
                    </div>
                  )}
                  {followUp("input-enquiry-next")}
                </div>
                <p className="text-xs text-muted-foreground">The stage (cold, hot or dead) follows the status you choose.</p>
                {enquiry.campaign?.name && <p className="text-xs text-muted-foreground" data-testid="text-enquiry-campaign">Campaign: {[enquiry.campaign.name, enquiry.campaign.adSet, enquiry.campaign.ad].filter(Boolean).join(" / ")}</p>}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 mt-4">
                {writeBox("note", "Add a note", "Add Note")}
                {entries(["note"], "No notes yet")}
              </TabsContent>

              <TabsContent value="calls" className="space-y-3 mt-4">
                <form className="space-y-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); addNote.mutate("call"); }}>
                  <Picker label="Call outcome" value={outcome} onChange={setOutcome} options={toOptions(CALL_OUTCOMES)} testId="select-call-outcome" />
                  <Textarea rows={2} required maxLength={2000} placeholder="Remarks" aria-label="Call remarks" value={texts.call} onChange={(e) => setTexts((t) => ({ ...t, call: e.target.value }))} data-testid="input-add-call" />
                  <Button type="submit" size="sm" disabled={addNote.isPending || !outcome || !texts.call.trim()} data-testid="button-add-call">Log Call</Button>
                </form>
                {entries(["call"], "No calls logged yet")}
              </TabsContent>

              <TabsContent value="discussions" className="space-y-3 mt-4">
                {writeBox("discussion", "What was discussed, in person or elsewhere", "Add Discussion")}
                {enquiry.phone && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium flex items-center gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</p>
                    {templates && templates.length > 0 && <Picker label="Template" value={template} onChange={pickTemplate} options={templates.map((t) => ({ value: t.name, label: t.name }))} allLabel="Write your own" testId="select-whatsapp-template" />}
                    <Textarea rows={3} maxLength={2000} placeholder="Message" aria-label="WhatsApp message" value={message} onChange={(e) => setMessage(e.target.value)} data-testid="input-whatsapp-message" />
                    <Button size="sm" disabled={whatsapp.isPending || !message.trim()} onClick={() => whatsapp.mutate()} data-testid="button-send-whatsapp">Send on WhatsApp</Button>
                  </div>
                )}
                {entries(["discussion", "whatsapp"], "No discussions yet")}
              </TabsContent>

              <TabsContent value="followups" className="space-y-3 mt-4">
                <div className="flex items-end gap-2 flex-wrap">
                  {followUp("input-followup-date")}
                  {enquiry.nextFollowUpDate && <Button size="sm" variant="ghost" onClick={() => update.mutate({ nextFollowUpDate: "" })} data-testid="button-clear-followup">Clear</Button>}
                </div>
                <p className="text-xs text-muted-foreground">The assigned telecaller gets a reminder on the follow-up date.</p>
                {entries(["followup"], "No follow-ups scheduled yet")}
              </TabsContent>

              <TabsContent value="status" className="space-y-3 mt-4">
                <Picker label="Status" value={enquiry.status} onChange={(status) => update.mutate({ status })} options={toOptions(ENQUIRY_STATUSES)} testId="select-status-history" />
                {entries(["status", "assigned"], "No status changes yet")}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {entries(undefined, "Nothing recorded yet")}
              </TabsContent>
            </Tabs>

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
