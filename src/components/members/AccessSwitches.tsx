import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export interface AccessItem {
  key: string;
  label: string;
  hint: string;
  module?: string;
  requires?: string;
  isModule: boolean;
  byRole: boolean;
}

interface Props {
  items: AccessItem[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

// The six module switches, each with the permissions inside it. A person gets exactly what is
// ticked here; a permission counts only while its module (and anything it requires) is on.
export default function AccessSwitches({ items, value, onChange, disabled }: Props) {
  const on = new Set(value);
  const set = (key: string, next: boolean) => {
    const copy = new Set(on);
    if (next) copy.add(key); else copy.delete(key);
    onChange(items.filter((i) => copy.has(i.key)).map((i) => i.key));
  };
  const modules = items.filter((i) => i.isModule);
  const live = (item: AccessItem) => (!item.module || on.has(item.module)) && (!item.requires || on.has(item.requires));
  const effective = items.filter((i) => !i.isModule && on.has(i.key) && live(i)).length + (on.has("members") ? 1 : 0);

  return (
    <div className="space-y-3" data-testid="access-switches">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground" data-testid="text-access-count">{effective} feature{effective === 1 ? "" : "s"} switched on</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(items.map((i) => i.key))} data-testid="button-access-all">Select All</Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange([])} data-testid="button-access-none">Clear</Button>
        </div>
      </div>
      {modules.map((m) => {
        const children = items.filter((i) => i.module === m.key);
        return (
          <div key={m.key} role="group" aria-label={m.label} className="rounded-md border" data-testid={`access-module-${m.key}`}>
            <div className="flex items-start justify-between gap-3 p-3 bg-muted/40">
              <label htmlFor={`access-${m.key}`} className="min-w-0">
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </label>
              <Switch id={`access-${m.key}`} checked={on.has(m.key)} disabled={disabled} onCheckedChange={(next) => set(m.key, next)} aria-label={m.label} data-testid={`switch-access-${m.key}`} />
            </div>
            {children.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                {children.map((c) => {
                  const blocked = !live(c);
                  return (
                    <div key={c.key} className={`flex items-start justify-between gap-3 rounded-md border p-2 ${blocked ? "opacity-50" : ""}`}>
                      <label htmlFor={`access-${c.key}`} className="text-sm min-w-0">
                        <span className="font-medium">{c.label}</span>
                        {c.byRole && <Badge variant="secondary" className="ml-1 text-[10px] align-middle">role default</Badge>}
                        <span className="block text-xs text-muted-foreground">{c.hint}</span>
                      </label>
                      <Switch id={`access-${c.key}`} checked={on.has(c.key) && !blocked} disabled={disabled || blocked} onCheckedChange={(next) => set(c.key, next)} aria-label={c.label} data-testid={`switch-access-${c.key}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
