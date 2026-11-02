import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomValue, TicketField } from "@/tickets/lib/types";

export const fieldsForType = (fields: TicketField[] = [], type: string) => fields.filter((f) => !f.ticketTypes.length || f.ticketTypes.includes(type));

interface Props {
  fields: TicketField[];
  values: Record<string, CustomValue>;
  onChange: (key: string, value: CustomValue) => void;
}

function FieldInput({ field, value, onChange }: { field: TicketField; value?: CustomValue; onChange: (value: CustomValue) => void }) {
  const id = `field-${field.key}`;
  const text = value === undefined ? "" : String(value);
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(!!checked)} data-testid={id} />
        {field.label}
      </label>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
      {field.type === "select" && (
        <Select value={text} onValueChange={onChange}>
          <SelectTrigger id={id} data-testid={id}><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>{field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {field.type === "textarea" && <Textarea id={id} rows={3} required={field.required} value={text} onChange={(e) => onChange(e.target.value)} data-testid={id} />}
      {["text", "number", "date"].includes(field.type) && (
        <Input id={id} type={field.type} required={field.required} value={text} onChange={(e) => onChange(e.target.value)} data-testid={id} />
      )}
    </div>
  );
}

// Admin-defined fields, grouped under their section names.
export default function CustomFieldInputs({ fields, values, onChange }: Props) {
  const sections = [...new Set(fields.map((f) => f.section || ""))];
  return (
    <>
      {sections.map((section) => (
        <fieldset key={section} className="space-y-3" data-testid={section ? `section-${section}` : undefined}>
          {section && <legend className="text-sm font-medium">{section}</legend>}
          {fields.filter((f) => (f.section || "") === section).map((field) => (
            <FieldInput key={field.key} field={field} value={values[field.key]} onChange={(value) => onChange(field.key, value)} />
          ))}
        </fieldset>
      ))}
    </>
  );
}
