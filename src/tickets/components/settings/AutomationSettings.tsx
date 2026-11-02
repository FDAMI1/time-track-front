import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { actionOptions, ACTIONS } from "@/tickets/lib/actions";
import { capitalize } from "@/tickets/lib/types";

interface Automation {
  _id: string;
  name: string;
  event: string;
  conditions: { field: string; value: string }[];
  actions: { type: string; value?: string }[];
  schedule?: { anchor: string; afterHours: number };
  isActive: boolean;
}

interface Run {
  _id: string;
  status: string;
  error?: string;
  event: string;
  createdAt: string;
  automationId?: { name: string };
  ticketId?: { ticketKey: string };
}

const EVENTS = [
  { value: "created", label: "Ticket created" },
  { value: "priority_changed", label: "Priority changed" },
  { value: "requester_replied", label: "Requester replied" },
  { value: "status_changed", label: "Status changed" },
  { value: "resolved", label: "Ticket resolved" },
  { value: "reopened", label: "Ticket reopened" },
  { value: "sla_warning", label: "SLA warning" },
  { value: "sla_breached", label: "SLA breached" },
  { value: "scheduled", label: "On a schedule" },
];
const ANCHORS = [
  { value: "updatedAt", label: "last update" },
  { value: "createdAt", label: "creation" },
  { value: "resolvedAt", label: "resolution" },
  { value: "sla.resolutionDueAt", label: "resolution deadline" },
];
const EMPTY = { name: "", event: "created", conditionField: "none", conditionValue: "", action: "notify_admins", actionValue: "", anchor: "updatedAt", afterHours: "24" };

export default function AutomationSettings() {
  const api = useMcqApi();
  const { list, save, remove } = useSettingsCrud<Automation>("automations");
  const { data: meta } = useTicketMeta();
  const [form, setForm] = useState(EMPTY);
  const runsUrl = "/api/tickets/settings/automation-runs";
  const { data: runs } = useQuery({ queryKey: [runsUrl], queryFn: () => api.get<Run[]>(runsUrl) });

  const conditionOptions = actionOptions(form.conditionField, meta);
  const thenOptions = actionOptions(form.action, meta);
  const rules = list.data || [];
  const row = (rule: Automation) => (
    <Card key={rule._id}>
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium">{rule.name}</p>
          <p className="text-xs text-muted-foreground">
            {rule.schedule?.afterHours ? `${rule.schedule.afterHours} hours after ${ANCHORS.find((a) => a.value === rule.schedule?.anchor)?.label}` : EVENTS.find((e) => e.value === rule.event)?.label}: {rule.actions.map((a) => ACTIONS.find((x) => x.value === a.type)?.label).join(", ")}
          </p>
        </div>
        {rule.isActive
          ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(rule._id)}>Delete</Button>
          : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: rule._id, body: { isActive: true } })} data-testid="button-restore-automation">Restore</Button>}
      </CardContent>
    </Card>
  );

  const submit = () => save.mutate({
    body: {
      name: form.name,
      event: form.event,
      conditions: form.conditionField === "none" ? [] : [{ field: form.conditionField, value: form.conditionValue }],
      actions: [{ type: form.action, value: form.actionValue || undefined }],
      ...(form.event === "scheduled" ? { schedule: { anchor: form.anchor, afterHours: Number(form.afterHours) } } : {}),
    },
  }, { onSuccess: () => setForm(EMPTY) });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="automation-name">Name</Label>
                <Input id="automation-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-automation-name" />
              </div>
              <div className="space-y-1">
                <Label>When</Label>
                <Select value={form.event} onValueChange={(event) => setForm({ ...form, event })}>
                  <SelectTrigger data-testid="select-automation-event"><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.event === "scheduled" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="automation-hours">Hours after</Label>
                    <Input id="automation-hours" type="number" min={1} max={8760} required value={form.afterHours} onChange={(e) => setForm({ ...form, afterHours: e.target.value })} data-testid="input-automation-hours" />
                  </div>
                  <div className="space-y-1">
                    <Label>Counting from</Label>
                    <Select value={form.anchor} onValueChange={(anchor) => setForm({ ...form, anchor })}>
                      <SelectTrigger data-testid="select-automation-anchor"><SelectValue /></SelectTrigger>
                      <SelectContent>{ANCHORS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label>Only if</Label>
                <Select value={form.conditionField} onValueChange={(conditionField) => setForm({ ...form, conditionField, conditionValue: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Every ticket</SelectItem>
                    <SelectItem value="priority">Priority is</SelectItem>
                    <SelectItem value="status">Status is</SelectItem>
                    <SelectItem value="categoryId">Category is</SelectItem>
                    <SelectItem value="groupId">Group is</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {conditionOptions && (
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Select value={form.conditionValue} onValueChange={(conditionValue) => setForm({ ...form, conditionValue })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{conditionOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Then</Label>
                <Select value={form.action} onValueChange={(action) => setForm({ ...form, action, actionValue: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {thenOptions && (
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Select value={form.actionValue} onValueChange={(actionValue) => setForm({ ...form, actionValue })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{thenOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.action === "add_tag" && (
                <div className="space-y-1">
                  <Label htmlFor="automation-tag">Tag</Label>
                  <Input id="automation-tag" required value={form.actionValue} onChange={(e) => setForm({ ...form, actionValue: e.target.value })} />
                </div>
              )}
            </div>
            <Button type="submit" disabled={save.isPending || (form.conditionField !== "none" && !form.conditionValue) || (!!thenOptions && !form.actionValue)} data-testid="button-save-automation">Add Automation</Button>
          </form>
        </CardContent>
      </Card>

      {rules.filter((r) => r.isActive).map(row)}

      {rules.some((r) => !r.isActive) && (
        <section className="space-y-2" aria-label="Trash" data-testid="section-automation-trash">
          <h2 className="text-sm font-medium">Trash</h2>
          {rules.filter((r) => !r.isActive).map(row)}
        </section>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Runs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!runs?.length && <p className="text-muted-foreground">No automations have run yet</p>}
          {runs?.slice(0, 50).map((run) => (
            <p key={run._id} className="flex gap-2 flex-wrap">
              <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{capitalize(run.status)}</Badge>
              <span>{run.automationId?.name}</span>
              <span className="text-muted-foreground">{run.ticketId?.ticketKey} · {new Date(run.createdAt).toLocaleString()}</span>
              {run.error && <span className="text-destructive">{run.error}</span>}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
