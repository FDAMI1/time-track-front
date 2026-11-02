import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { actionOptions, ACTIONS } from "@/tickets/lib/actions";

interface Scenario {
  _id: string;
  name: string;
  actions: { type: string; value?: string }[];
  isActive: boolean;
}

const EMPTY = { name: "", action: "set_status", value: "" };

export default function ScenarioSettings() {
  const { list, save, remove } = useSettingsCrud<Scenario>("scenarios");
  const { data: meta } = useTicketMeta();
  const [form, setForm] = useState(EMPTY);
  const [steps, setSteps] = useState<{ type: string; value?: string }[]>([]);
  const options = actionOptions(form.action, meta);
  const label = (type: string) => ACTIONS.find((a) => a.value === type)?.label || type;

  const addStep = () => {
    setSteps([...steps, { type: form.action, value: form.value || undefined }]);
    setForm({ ...form, value: "" });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">A scenario is a set of actions an agent runs on a ticket with one click.</p>
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ body: { name: form.name, actions: steps } }, { onSuccess: () => { setForm(EMPTY); setSteps([]); } }); }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="scenario-name">Name</Label>
                <Input id="scenario-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-scenario-name" />
              </div>
              <div className="space-y-1">
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(action) => setForm({ ...form, action, value: "" })}>
                  <SelectTrigger data-testid="select-scenario-action"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {options && (
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Select value={form.value} onValueChange={(value) => setForm({ ...form, value })}>
                    <SelectTrigger data-testid="select-scenario-value"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.action === "add_tag" && (
                <div className="space-y-1">
                  <Label htmlFor="scenario-tag">Tag</Label>
                  <Input id="scenario-tag" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="input-scenario-tag" />
                </div>
              )}
            </div>
            <Button type="button" variant="outline" disabled={(!!options || form.action === "add_tag") && !form.value} onClick={addStep} data-testid="button-add-step">Add Action</Button>
            {steps.length > 0 && <p className="text-sm text-muted-foreground">{steps.map((s) => label(s.type)).join(", then ")}</p>}
            <div><Button type="submit" disabled={save.isPending || !steps.length} data-testid="button-save-scenario">Save Scenario</Button></div>
          </form>
        </CardContent>
      </Card>
      {list.data?.map((scenario) => (
        <Card key={scenario._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium break-words">{scenario.name} {!scenario.isActive && <Badge variant="outline">Inactive</Badge>}</p>
              <p className="text-xs text-muted-foreground">{scenario.actions.map((a) => label(a.type)).join(", then ")}</p>
            </div>
            {scenario.isActive
              ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(scenario._id)}>Deactivate</Button>
              : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: scenario._id, body: { isActive: true } })}>Activate</Button>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
