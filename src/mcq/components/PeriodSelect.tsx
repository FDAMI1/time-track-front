import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export type Period = "daily" | "weekly" | "monthly" | "yearly" | "all";

export const periodLabels: Record<Period, string> = {
  daily: "Today",
  weekly: "Last 7 Days",
  monthly: "Last 30 Days",
  yearly: "Last Year",
  all: "All Time",
};

interface PeriodSelectProps {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
}

export default function PeriodSelect({ value, onChange, className }: PeriodSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Period)}>
      <SelectTrigger className={className || "w-[160px] h-9"} data-testid="select-period">
        <Calendar className="w-4 h-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <SelectItem key={p} value={p} data-testid={`option-period-${p}`}>{periodLabels[p]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
