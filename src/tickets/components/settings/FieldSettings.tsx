import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";
import { capitalize, TICKET_TYPES, type TicketField } from "@/tickets/lib/types";

const TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];
const EMPTY = { label: "", type: "text", options: "", section: "", required: false, agentOnly: false, ticketTypes: [] as string[] };

export default function FieldSettings() {
  const { list, save, remove } = useSettingsCrud<TicketField>("fields");
  const [form, setForm] = useState(EMPTY);

  const submit = () => save.mutate({
    body: { ...form, options: form.options.split(",").map((o) => o.trim()).filter(Boolean) },
  }, { onSuccess: () => setForm(EMPTY) });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Extra fields appear on ticket forms. A section groups fields under a heading, and you can show a field for certain ticket types only.</p>
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="field-label">Field name</Label>
                <Input id="field-label" required maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} data-testid="input-field-label" />
              </div>
              <div className="space-y-1">
                <Label>Kind</Label>
                <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                  <SelectTrigger data-testid="select-field-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="field-section">Section (optional)</Label>
                <Input id="field-section" maxLength={60} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} data-testid="input-field-section" />
              </div>
              {form.type === "select" && (
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="field-options">Options (separated by commas)</Label>
                  <Input id="field-options" required value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} data-testid="input-field-options" />
                </div>
              )}
            </div>
            <fieldset className="flex items-center gap-4 flex-wrap text-sm">
              <legend className="text-sm font-medium mb-1">Show for (none ticked means every type)</legend>
              {TICKET_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.ticketTypes.includes(type.value)}
                    onCheckedChange={(checked) => setForm({ ...form, ticketTypes: checked ? [...form.ticketTypes, type.value] : form.ticketTypes.filter((t) => t !== type.value) })}
                  />
                  {type.label}
                </label>
              ))}
            </fieldset>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: !!v })} data-testid="checkbox-field-required" />Required</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.agentOnly} onCheckedChange={(v) => setForm({ ...form, agentOnly: !!v })} data-testid="checkbox-field-agent" />Agents only</label>
            </div>
            <Button type="submit" disabled={save.isPending} data-testid="button-save-field">Add Field</Button>
          </form>
        </CardContent>
      </Card>
      {list.data?.map((field) => (
        <Card key={field._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium break-words">{field.label} {!field.isActive && <Badge variant="outline">Inactive</Badge>}</p>
              <p className="text-xs text-muted-foreground">
                {capitalize(field.type)}{field.section ? ` · ${field.section}` : ""}{field.required ? " · Required" : ""}{field.agentOnly ? " · Agents only" : ""}
              </p>
            </div>
            {field.isActive
              ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(field._id)}>Deactivate</Button>
              : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: field._id, body: { isActive: true } })}>Activate</Button>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
