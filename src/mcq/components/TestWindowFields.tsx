import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublishRule } from "@/mcq/lib/types";

// Converts between the ISO strings the API uses and the "YYYY-MM-DDTHH:mm"
// local-time strings a datetime-local input needs.
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface Props {
  startDate: string;
  endDate: string;
  publishRule: PublishRule;
  onChange: (value: { startDate: string; endDate: string }) => void;
  idPrefix: string;
}

// Availability window of a test. Takers can start it only between the two
// times; a scheduled test releases its results when the window closes.
export default function TestWindowFields({ startDate, endDate, publishRule, onChange, idPrefix }: Props) {
  const scheduled = publishRule === "SCHEDULED";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Opens at <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input
            id={`${idPrefix}-start`}
            type="datetime-local"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value, endDate })}
            data-testid={`input-${idPrefix}-start-date`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end`}>Closes at {scheduled ? <span className="text-destructive">*</span> : <span className="text-xs text-muted-foreground">(optional)</span>}</Label>
          <Input
            id={`${idPrefix}-end`}
            type="datetime-local"
            value={endDate}
            min={startDate || undefined}
            required={scheduled}
            onChange={(e) => onChange({ startDate, endDate: e.target.value })}
            data-testid={`input-${idPrefix}-end-date`}
          />
        </div>
      </div>
      {scheduled && <p className="text-xs text-muted-foreground">Results are released to takers when the test closes.</p>}
    </div>
  );
}
