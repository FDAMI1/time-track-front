import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";

type FieldValue = string | number | string[];

interface ActionField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "options" | "answer";
  required?: boolean;
  options?: string[];
  value: FieldValue;
}

export interface AssistantAction {
  id?: string;
  key: string;
  label: string;
  path: string;
  page: { label: string; path: string };
  fields: ActionField[];
}

interface Props {
  action: AssistantAction;
  onDone: () => void;
  onCancel: () => void;
}

// Nothing is saved until the user confirms. The draft then goes to the portal's
// normal route, so its permissions and validation decide the result.
export default function ActionCard({ action, onDone, onCancel }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, FieldValue>>(() => Object.fromEntries(action.fields.map((f) => [f.name, f.value])));
  const set = (name: string, value: FieldValue) => setValues((v) => ({ ...v, [name]: value }));

  const body = () => {
    const out: Record<string, FieldValue> = {};
    for (const field of action.fields) {
      const value = values[field.name];
      if (value !== "") out[field.name] = field.type === "number" || field.type === "answer" ? Number(value) : value;
    }
    return out;
  };

  const save = useMutation({
    mutationFn: () => api.post(action.path, body()),
    onSuccess: onDone,
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  const options = (values.options as string[] | undefined) || [];
  const missing = action.fields.some((f) => {
    const value = values[f.name];
    return f.required && (value === "" || (Array.isArray(value) && value.filter((o) => o.trim()).length < 2));
  });

  return (
    <form
      className="rounded-lg border p-3 space-y-2"
      data-testid="assistant-action-card"
      onSubmit={(e) => { e.preventDefault(); if (!missing) save.mutate(); }}
    >
      <p className="text-sm font-semibold">{action.label}</p>
      <p className="text-xs text-muted-foreground">Check this draft. Nothing is saved until you confirm.</p>
      {action.fields.map((field) => {
        const id = `action-${field.name}`;
        const value = values[field.name];
        if (field.type === "options") {
          return (
            <fieldset key={field.name} className="space-y-1">
              <legend className="text-xs font-medium">{field.label}</legend>
              {options.map((option, i) => (
                <Input
                  key={i}
                  value={option}
                  aria-label={`Option ${i + 1}`}
                  data-testid={`action-option-${i}`}
                  onChange={(e) => set("options", options.map((o, n) => (n === i ? e.target.value : o)))}
                />
              ))}
            </fieldset>
          );
        }
        const choices = field.type === "answer"
          ? options.map((option, i) => ({ value: String(i), label: option || `Option ${i + 1}` }))
          : field.options?.map((option) => ({ value: option, label: option }));
        return (
          <div key={field.name} className="space-y-1">
            <Label htmlFor={id} className="text-xs">{field.label}</Label>
            {choices ? (
              <Select value={String(value)} onValueChange={(next) => set(field.name, next)}>
                <SelectTrigger id={id} data-testid={id}><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea id={id} rows={2} value={String(value)} onChange={(e) => set(field.name, e.target.value)} data-testid={id} />
            ) : (
              <Input id={id} type={field.type} value={String(value)} onChange={(e) => set(field.name, e.target.value)} data-testid={id} />
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={missing || save.isPending} data-testid="button-confirm-action">Confirm and save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
