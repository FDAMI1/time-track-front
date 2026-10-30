import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { capitalize, PRIORITIES } from "@/tickets/lib/types";

interface Calendar {
  _id: string;
  name: string;
  timezone: string;
  hours: { day: number; start: string; end: string }[];
  holidays: { date: string; name?: string }[];
  isActive: boolean;
}

type Targets = Record<string, { firstResponseMinutes: number; resolutionMinutes: number }>;

interface Policy {
  _id: string;
  name: string;
  isDefault: boolean;
  calendarId?: string | null;
  targets: Targets;
  warnBeforeMinutes: number;
  escalateToGroupId?: string | null;
  isActive: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyCalendar = () => ({
  name: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
  holidays: "",
});
const emptyPolicy = () => ({
  name: "",
  isDefault: false,
  calendarId: "none",
  warnBeforeMinutes: 30,
  escalateToGroupId: "none",
  targets: Object.fromEntries(PRIORITIES.map((p) => [p, { firstResponseMinutes: 0, resolutionMinutes: 0 }])) as Targets,
});

function CalendarForm() {
  const { list, save, remove } = useSettingsCrud<Calendar>("calendars");
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(emptyCalendar());
  const reset = () => { setEditing(undefined); setForm(emptyCalendar()); };

  const submit = () => save.mutate({
    id: editing,
    body: {
      name: form.name,
      timezone: form.timezone,
      hours: form.days.map((day) => ({ day, start: form.start, end: form.end })),
      holidays: form.holidays.split(/[\s,]+/).filter(Boolean).map((date) => ({ date })),
    },
  }, { onSuccess: reset });

  const edit = (calendar: Calendar) => {
    setEditing(calendar._id);
    setForm({
      name: calendar.name,
      timezone: calendar.timezone,
      days: calendar.hours.map((h) => h.day),
      start: calendar.hours[0]?.start || "09:00",
      end: calendar.hours[0]?.end || "17:00",
      holidays: calendar.holidays.map((h) => h.date).join(", "),
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Business Calendars</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="calendar-name">Name</Label>
              <Input id="calendar-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-calendar-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-zone">Time zone</Label>
              <Input id="calendar-zone" required value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-start">Opens</Label>
              <Input id="calendar-start" type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-end">Closes</Label>
              <Input id="calendar-end" type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>
          <fieldset className="flex gap-3 flex-wrap">
            <legend className="text-sm font-medium mb-1">Working days</legend>
            {DAYS.map((day, index) => (
              <label key={day} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={form.days.includes(index)}
                  onCheckedChange={(checked) => setForm({ ...form, days: checked ? [...form.days, index].sort() : form.days.filter((d) => d !== index) })}
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="calendar-holidays">Holidays, as YYYY-MM-DD separated by commas</Label>
            <Input id="calendar-holidays" value={form.holidays} onChange={(e) => setForm({ ...form, holidays: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending} data-testid="button-save-calendar">{editing ? "Update Calendar" : "Add Calendar"}</Button>
            {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </form>
        {list.data?.map((calendar) => (
          <div key={calendar._id} className="flex items-center justify-between gap-3 flex-wrap border-t pt-3">
            <p className="text-sm">{calendar.name} <span className="text-muted-foreground">({calendar.timezone})</span> {!calendar.isActive && <Badge variant="outline">Inactive</Badge>}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => edit(calendar)}>Edit</Button>
              {calendar.isActive && <Button variant="ghost" size="sm" onClick={() => remove.mutate(calendar._id)}>Deactivate</Button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PolicyForm() {
  const { list, save, remove } = useSettingsCrud<Policy>("sla-policies");
  const calendars = useSettingsCrud<Calendar>("calendars").list.data;
  const { data: meta } = useTicketMeta();
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(emptyPolicy());
  const reset = () => { setEditing(undefined); setForm(emptyPolicy()); };

  const setTarget = (priority: string, field: "firstResponseMinutes" | "resolutionMinutes", value: number) =>
    setForm({ ...form, targets: { ...form.targets, [priority]: { ...form.targets[priority], [field]: value } } });

  const submit = () => save.mutate({
    id: editing,
    body: {
      name: form.name,
      isDefault: form.isDefault,
      warnBeforeMinutes: form.warnBeforeMinutes,
      calendarId: form.calendarId === "none" ? null : form.calendarId,
      escalateToGroupId: form.escalateToGroupId === "none" ? null : form.escalateToGroupId,
      targets: form.targets,
    },
  }, { onSuccess: reset });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">SLA Policies</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">Tickets have no deadlines until you add a default policy.</p>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="policy-name">Name</Label>
              <Input id="policy-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-policy-name" />
            </div>
            <div className="space-y-1">
              <Label>Hours</Label>
              <Select value={form.calendarId} onValueChange={(calendarId) => setForm({ ...form, calendarId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Calendar hours (24/7)</SelectItem>
                  {calendars?.filter((c) => c.isActive).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-warn">Warn before (minutes)</Label>
              <Input id="policy-warn" type="number" min={0} max={10080} value={form.warnBeforeMinutes} onChange={(e) => setForm({ ...form, warnBeforeMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Escalate breaches to</Label>
              <Select value={form.escalateToGroupId} onValueChange={(escalateToGroupId) => setForm({ ...form, escalateToGroupId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No escalation group</SelectItem>
                  {meta?.groups.map((g) => <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1 font-medium">Priority</th>
                  <th className="p-1 font-medium">First response (minutes)</th>
                  <th className="p-1 font-medium">Resolution (minutes)</th>
                </tr>
              </thead>
              <tbody>
                {PRIORITIES.map((priority) => (
                  <tr key={priority}>
                    <th className="p-1 text-left font-medium">{capitalize(priority)}</th>
                    <td className="p-1 min-w-32"><Input type="number" min={1} required aria-label={`${priority} first response minutes`} value={form.targets[priority].firstResponseMinutes || ""} onChange={(e) => setTarget(priority, "firstResponseMinutes", Number(e.target.value))} data-testid={`input-${priority}-first`} /></td>
                    <td className="p-1 min-w-32"><Input type="number" min={1} required aria-label={`${priority} resolution minutes`} value={form.targets[priority].resolutionMinutes || ""} onChange={(e) => setTarget(priority, "resolutionMinutes", Number(e.target.value))} data-testid={`input-${priority}-resolution`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: !!checked })} data-testid="checkbox-policy-default" />
            Default policy for tickets no other policy matches
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending} data-testid="button-save-policy">{editing ? "Update Policy" : "Add Policy"}</Button>
            {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </form>
        {list.data?.map((policy) => (
          <div key={policy._id} className="flex items-center justify-between gap-3 flex-wrap border-t pt-3">
            <p className="text-sm">{policy.name} {policy.isDefault && <Badge>Default</Badge>} {!policy.isActive && <Badge variant="outline">Inactive</Badge>}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(policy._id);
                  setForm({ name: policy.name, isDefault: policy.isDefault, calendarId: policy.calendarId || "none", warnBeforeMinutes: policy.warnBeforeMinutes, escalateToGroupId: policy.escalateToGroupId || "none", targets: policy.targets });
                }}
              >Edit</Button>
              {policy.isActive && <Button variant="ghost" size="sm" onClick={() => remove.mutate(policy._id)}>Deactivate</Button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SlaSettings() {
  return (
    <div className="space-y-4">
      <PolicyForm />
      <CalendarForm />
    </div>
  );
}
