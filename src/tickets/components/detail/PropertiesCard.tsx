import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CustomFieldInputs, { fieldsForType } from "@/tickets/components/CustomFieldInputs";
import MajorIncidentInputs from "@/tickets/components/MajorIncidentInputs";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import { AGENT_SOURCES, capitalize, personName, PRIORITIES, SCALE, sourceLabel, TICKET_TYPES, type CustomValue, type MajorIncident, type Ticket, type TicketMeta } from "@/tickets/lib/types";

interface Props {
  controls: TicketControls;
  meta?: TicketMeta;
}

const day = (value?: string | null) => (value ? value.slice(0, 10) : "");

const draftOf = (t: Ticket) => ({
  status: t.status,
  priority: t.priority,
  urgency: t.urgency || "",
  impact: t.impact || "",
  type: t.type,
  source: t.source,
  groupId: t.groupId?._id || "none",
  agentId: t.agentId?._id || "none",
  departmentId: t.departmentId?._id || "none",
  categoryId: t.categoryId?._id || "none",
  plannedStartAt: day(t.plannedStartAt),
  plannedEndAt: day(t.plannedEndAt),
  plannedEffort: t.plannedEffort || "",
  tags: t.tags.join(", "),
});

type Draft = ReturnType<typeof draftOf>;

function Choice({ label, testId, value, onChange, options }: { label: string; testId?: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9" data-testid={testId}><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function ReadOnly({ ticket, meta, permissions, action }: { ticket: Ticket; meta?: TicketMeta; permissions: { reopen: boolean }; action: TicketControls["action"] }) {
  const fields = fieldsForType(meta?.fields, ticket.type);
  const shown = fields.filter((f) => ticket.customFields?.[f.key] !== undefined);
  return (
    <>
      <p><span className="text-muted-foreground">Group: </span>{ticket.groupId?.name || "Not assigned yet"}</p>
      <p><span className="text-muted-foreground">Agent: </span>{personName(ticket.agentId) || "Not assigned yet"}</p>
      <p><span className="text-muted-foreground">Category: </span>{ticket.categoryId?.name || "None"}{ticket.subcategory ? ` / ${ticket.subcategory}` : ""}</p>
      <p><span className="text-muted-foreground">Type: </span>{capitalize(ticket.type.replace("_", " "))}</p>
      <p><span className="text-muted-foreground">Source: </span>{sourceLabel(ticket.source)}</p>
      {ticket.tags.length > 0 && <p className="flex gap-1 flex-wrap">{ticket.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</p>}
      {shown.map((f) => <p key={f.key} className="break-words"><span className="text-muted-foreground">{f.label}: </span>{String(ticket.customFields?.[f.key])}</p>)}
      {permissions.reopen && <Button variant="outline" className="w-full" onClick={() => action.mutate({ path: "reopen" })} data-testid="button-reopen-ticket">Reopen Ticket</Button>}
    </>
  );
}

// Changes wait here until Update, then go through the normal routes: fields first,
// assignment next, and status last, so a refused status leaves the rest saved and says why.
export default function PropertiesCard({ controls, meta }: Props) {
  const { data, url, api, action, refresh, onError, toast } = controls;
  const ticket = data?.ticket;
  const [draft, setDraft] = useState<Draft | null>(ticket ? draftOf(ticket) : null);
  const [custom, setCustom] = useState<Record<string, CustomValue>>(ticket?.customFields || {});
  const [major, setMajor] = useState<MajorIncident>(ticket?.majorIncident || {});
  const [transferReason, setTransferReason] = useState("");
  // Anyone allowed to use Tickets can take one on; the server checks each choice.
  const people = meta?.assignees?.length ? meta.assignees : meta?.agents || [];
  useEffect(() => {
    if (!ticket) return;
    setDraft(draftOf(ticket));
    setCustom(ticket.customFields || {});
    setMajor(ticket.majorIncident || {});
  }, [ticket?.updatedAt]);

  const save = useMutation({
    mutationFn: async () => {
      if (!ticket || !draft) return;
      const base = draftOf(ticket);
      const changed = (key: keyof Draft) => draft[key] !== base[key];
      const body: Record<string, unknown> = {};
      for (const key of ["priority", "type", "source", "plannedEffort"] as const) if (changed(key)) body[key] = draft[key];
      for (const key of ["urgency", "impact"] as const) if (changed(key) && draft[key]) body[key] = draft[key];
      for (const key of ["plannedStartAt", "plannedEndAt"] as const) if (changed(key)) body[key] = draft[key] || null;
      for (const key of ["departmentId", "categoryId"] as const) if (changed(key)) body[key] = draft[key] === "none" ? null : draft[key];
      if (changed("tags")) body.tags = draft.tags;
      const fields = fieldsForType(meta?.fields, draft.type);
      const customChanges = Object.fromEntries(fields.filter((f) => custom[f.key] !== ticket.customFields?.[f.key]).map((f) => [f.key, custom[f.key] ?? ""]));
      if (Object.keys(customChanges).length) body.customFields = customChanges;
      if (draft.type === "major_incident" && JSON.stringify(major) !== JSON.stringify(ticket.majorIncident || {})) body.majorIncident = major;
      if (Object.keys(body).length) await api.put(url, body);

      if (changed("groupId") || changed("agentId")) {
        const agentId = draft.agentId === "none" ? null : draft.agentId;
        const reason = transferReason.trim() || undefined;
        await api.post(`${url}/assign`, changed("groupId")
          ? { groupId: draft.groupId === "none" ? null : draft.groupId, agentId: changed("agentId") ? agentId : null, reason }
          : { agentId, reason });
      }
      if (changed("status")) await api.post(`${url}/status`, { status: draft.status });
    },
    onSuccess: () => { setTransferReason(""); refresh(); toast({ title: "Ticket updated" }); },
    onError: (err: Error) => { refresh(); onError(err); },
  });

  if (!data || !ticket) return null;
  const { permissions } = data;

  return (
    <Card data-testid="card-properties">
      {/* The header stays in view so changes can be saved without scrolling to the end. */}
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0 sticky top-0 z-10 bg-card rounded-t-lg border-b">
        <CardTitle className="text-sm">Properties</CardTitle>
        {permissions.manage && draft && (
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()} aria-busy={save.isPending} data-testid="button-update-properties">
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{save.isPending ? "Saving..." : "Update"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm pt-3">
        {!permissions.manage || !draft ? <ReadOnly ticket={ticket} meta={meta} permissions={permissions} action={action} /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5" data-testid="grid-properties">
              <Choice label="Status *" testId="select-ticket-status" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={(meta?.statuses || []).map((st) => ({ value: st.key, label: st.label }))} />
              <Choice label="Priority *" testId="select-properties-priority" value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} options={PRIORITIES.map((pr) => ({ value: pr, label: capitalize(pr) }))} />
              <Choice label="Urgency" testId="select-properties-urgency" value={draft.urgency} onChange={(urgency) => setDraft({ ...draft, urgency })} options={SCALE.map((sc) => ({ value: sc, label: capitalize(sc) }))} />
              <Choice label="Impact" testId="select-properties-impact" value={draft.impact} onChange={(impact) => setDraft({ ...draft, impact })} options={SCALE.map((sc) => ({ value: sc, label: capitalize(sc) }))} />
              <Choice label="Type" testId="select-properties-type" value={draft.type} onChange={(type) => setDraft({ ...draft, type })} options={TICKET_TYPES} />
              <Choice label="Source" testId="select-properties-source" value={draft.source} onChange={(source) => setDraft({ ...draft, source })} options={ticket.source === "assistant" ? [{ value: "assistant", label: "Assistant" }, ...AGENT_SOURCES] : AGENT_SOURCES} />
              <Choice label="Group" testId="select-ticket-group" value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} options={[{ value: "none", label: "Unassigned" }, ...(meta?.groups || []).map((g) => ({ value: g._id, label: g.name }))]} />
              <Choice label="Owner" testId="select-ticket-agent" value={draft.agentId} onChange={(agentId) => setDraft({ ...draft, agentId })} options={[{ value: "none", label: "Unassigned" }, ...people.map((a) => ({ value: a._id, label: personName(a) || a.username }))]} />
              {ticket.agentId && draft.agentId !== draftOf(ticket).agentId && (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="transfer-reason" className="text-xs">Reason for transfer (optional)</Label>
                  <Input id="transfer-reason" className="h-9" maxLength={500} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} data-testid="input-transfer-reason" />
                  <p className="text-xs text-muted-foreground">Once you hand it on, the ticket leaves your inbox and you can no longer open it.</p>
                </div>
              )}
              <Choice label="Department" testId="select-properties-department" value={draft.departmentId} onChange={(departmentId) => setDraft({ ...draft, departmentId })} options={[{ value: "none", label: "None" }, ...(meta?.departments || []).map((d) => ({ value: d._id, label: d.departmentName }))]} />
              <Choice label="Category" testId="select-properties-category" value={draft.categoryId} onChange={(categoryId) => setDraft({ ...draft, categoryId })} options={[{ value: "none", label: "None" }, ...(meta?.categories || []).map((c) => ({ value: c._id, label: c.name }))]} />
              <div className="space-y-1 min-w-0">
                <Label htmlFor="properties-start" className="text-xs">Planned Start</Label>
                <Input id="properties-start" className="h-9" type="date" value={draft.plannedStartAt} onChange={(e) => setDraft({ ...draft, plannedStartAt: e.target.value })} data-testid="input-properties-start" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="properties-end" className="text-xs">Planned End</Label>
                <Input id="properties-end" className="h-9" type="date" value={draft.plannedEndAt} onChange={(e) => setDraft({ ...draft, plannedEndAt: e.target.value })} data-testid="input-properties-end" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="properties-effort" className="text-xs">Planned Effort</Label>
                <Input id="properties-effort" className="h-9" maxLength={40} placeholder="e.g. 2h" value={draft.plannedEffort} onChange={(e) => setDraft({ ...draft, plannedEffort: e.target.value })} data-testid="input-properties-effort" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="properties-tags" className="text-xs">Tags (comma separated)</Label>
                <Input id="properties-tags" className="h-9" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} data-testid="input-properties-tags" />
              </div>
            </div>
            {draft.type === "major_incident" && <MajorIncidentInputs value={major} onChange={setMajor} />}
            <CustomFieldInputs fields={fieldsForType(meta?.fields, draft.type)} values={custom} onChange={(key, value) => setCustom((c) => ({ ...c, [key]: value }))} />
            {permissions.reopen && <Button variant="outline" className="w-full" onClick={() => action.mutate({ path: "reopen" })} data-testid="button-reopen-ticket">Reopen Ticket</Button>}
          </>
        )}
        {meta?.isAdmin && !ticket.isArchived && <Button variant="ghost" className="w-full" onClick={() => action.mutate({ path: "archive" })} data-testid="button-archive-ticket">Archive</Button>}
      </CardContent>
    </Card>
  );
}
