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
import { capitalize, personName, PRIORITIES } from "@/tickets/lib/types";

interface Automation {
  _id: string;
  name: string;
  event: string;
  conditions: { field: string; value: string }[];
  actions: { type: string; value?: string }[];
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
];
const ACTIONS = [
  { value: "notify_admins", label: "Notify admins" },
  { value: "notify_lead", label: "Notify group lead" },
  { value: "notify_user", label: "Notify an agent" },
  { value: "set_priority", label: "Set priority" },
  { value: "set_status", label: "Set status" },
  { value: "assign_group", label: "Assign group" },
  { value: "assign_agent", label: "Assign agent" },
  { value: "add_tag", label: "Add tag" },
];
const EMPTY = { name: "", event: "created", conditionField: "none", conditionValue: "", action: "notify_admins", actionValue: "" };

export default function AutomationSettings() {
  const api = useMcqApi();
  const { list, save, remove } = useSettingsCrud<Automation>("automations");
  const { data: meta } = useTicketMeta();
  const [form, setForm] = useState(EMPTY);
  const runsUrl = "/api/tickets/settings/automation-runs";
  const { data: runs } = useQuery({ queryKey: [runsUrl], queryFn: () => api.get<Run[]>(runsUrl) });

  const options = (key: string) => {
    if (key === "priority" || key === "set_priority") return PRIORITIES.map((p) => ({ value: p, label: capitalize(p) }));
    if (key === "status" || key === "set_status") return (meta?.statuses || []).map((s) => ({ value: s.key, label: s.label }));
    if (key === "categoryId") return (meta?.categories || []).map((c) => ({ value: c._id, label: c.name }));
    if (key === "groupId" || key === "assign_group") return (meta?.groups || []).map((g) => ({ value: g._id, label: g.name }));
    if (key === "assign_agent" || key === "notify_user") return (meta?.agents || []).map((a) => ({ value: a._id, label: personName(a) || a.username }));
    return null;
  };
  const conditionOptions = options(form.conditionField);
  const actionOptions = options(form.action);

  const submit = () => save.mutate({
    body: {
      name: form.name,
      event: form.event,
      conditions: form.conditionField === "none" ? [] : [{ field: form.conditionField, value: form.conditionValue }],
      actions: [{ type: form.action, value: form.actionValue || undefined }],
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
              {actionOptions && (
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Select value={form.actionValue} onValueChange={(actionValue) => setForm({ ...form, actionValue })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{actionOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
            <Button type="submit" disabled={save.isPending || (form.conditionField !== "none" && !form.conditionValue) || (!!actionOptions && !form.actionValue)} data-testid="button-save-automation">Add Automation</Button>
          </form>
        </CardContent>
      </Card>

      {list.data?.map((rule) => (
        <Card key={rule._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium">{rule.name} {!rule.isActive && <Badge variant="outline">Inactive</Badge>}</p>
              <p className="text-xs text-muted-foreground">{EVENTS.find((e) => e.value === rule.event)?.label}: {rule.actions.map((a) => ACTIONS.find((x) => x.value === a.type)?.label).join(", ")}</p>
            </div>
            {rule.isActive
              ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(rule._id)}>Deactivate</Button>
              : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: rule._id, body: { isActive: true } })}>Activate</Button>}
          </CardContent>
        </Card>
      ))}

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
