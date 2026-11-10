import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import CustomFieldInputs, { fieldsForType } from "@/tickets/components/CustomFieldInputs";
import MajorIncidentInputs from "@/tickets/components/MajorIncidentInputs";
import AttachmentDrop, { useAttachments } from "@/tickets/components/AttachmentDrop";
import { AGENT_SOURCES, capitalize, PRIORITIES, SCALE, TICKET_TYPES, type CustomValue, type MajorIncident, type Ticket, type TicketMeta } from "@/tickets/lib/types";

const EMPTY = { subject: "", description: "", categoryId: "", subcategory: "", type: "incident", priority: "medium", urgency: "medium", impact: "medium", source: "portal", plannedStartAt: "", plannedEndAt: "" };
const AGENT_KEYS = ["source", "plannedStartAt", "plannedEndAt"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta?: TicketMeta;
}

export default function NewTicketDialog({ open, onOpenChange, meta }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(EMPTY);
  const attachments = useAttachments();
  const [assignee, setAssignee] = useState("none");
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [major, setMajor] = useState<MajorIncident>({});
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const subcategories = meta?.categories.find((c) => c._id === form.categoryId)?.subcategories || [];
  const fields = fieldsForType(meta?.fields, form.type);
  const agent = !!meta?.isAgent;

  const reset = () => { setForm(EMPTY); attachments.clear(); setAssignee("none"); setCustom({}); setMajor({}); };

  const create = useMutation({
    mutationFn: () => {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        const skip = (meta?.matrixEnabled ? key === "priority" : key === "urgency" || key === "impact") || (!agent && AGENT_KEYS.includes(key));
        if (value && !skip) body.append(key, value);
      }
      const shown = Object.fromEntries(fields.filter((f) => custom[f.key] !== undefined).map((f) => [f.key, custom[f.key]]));
      body.append("customFields", JSON.stringify(shown));
      if (assignee !== "none") body.append("agentId", assignee);
      if (agent && form.type === "major_incident") body.append("majorIncident", JSON.stringify(major));
      attachments.files.forEach((file) => body.append("files", file));
      return api.post<Ticket>("/api/tickets", body);
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      onOpenChange(false);
      reset();
      toast({ title: `Ticket ${ticket.ticketKey} created` });
      navigate(`/${ticket._id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? "New Ticket" : "Report an issue"}</DialogTitle>
          <DialogDescription>Describe the problem. The support team will reply here.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" required maxLength={200} value={form.subject} onChange={(e) => set("subject", e.target.value)} data-testid="input-ticket-subject" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" required rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} onPaste={attachments.onPaste} data-testid="input-ticket-description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v, subcategory: "" }))}>
                <SelectTrigger data-testid="select-ticket-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{meta?.categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {subcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={form.subcategory} onValueChange={(v) => set("subcategory", v)}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger data-testid="select-ticket-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {meta?.matrixEnabled ? (
              (["urgency", "impact"] as const).map((field) => (
                <div className="space-y-2" key={field}>
                  <Label>{capitalize(field)}</Label>
                  <Select value={form[field]} onValueChange={(v) => set(field, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SCALE.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                  <SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {!!meta?.assignees?.length && (
              <div className="space-y-2">
                <Label>Assign to (optional)</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger data-testid="select-ticket-assignee"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Let the team pick it up</SelectItem>
                    {meta.assignees.map((p) => <SelectItem key={p._id} value={p._id}>{`${p.firstName || ""} ${p.lastName || ""}`.trim() || p.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {agent && (
              <>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => set("source", v)}>
                    <SelectTrigger data-testid="select-ticket-source"><SelectValue /></SelectTrigger>
                    <SelectContent>{AGENT_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="hidden sm:block" aria-hidden="true" />
                <div className="space-y-2">
                  <Label htmlFor="ticket-start">Planned Start Date</Label>
                  <Input id="ticket-start" type="date" value={form.plannedStartAt} onChange={(e) => set("plannedStartAt", e.target.value)} data-testid="input-planned-start" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-end">Planned End Date</Label>
                  <Input id="ticket-end" type="date" value={form.plannedEndAt} onChange={(e) => set("plannedEndAt", e.target.value)} data-testid="input-planned-end" />
                </div>
              </>
            )}
          </div>
          {agent && form.type === "major_incident" && <MajorIncidentInputs value={major} onChange={setMajor} />}
          <CustomFieldInputs fields={fields} values={custom} onChange={(key, value) => setCustom((c) => ({ ...c, [key]: value }))} />
          <div className="space-y-2">
            <Label htmlFor="ticket-files">Attachments (up to 5 PDF, PNG or JPG files, 5 MB each)</Label>
            <AttachmentDrop attachments={attachments} id="ticket-files" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-ticket">
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Ticket
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
