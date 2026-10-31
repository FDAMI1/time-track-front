import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";

interface StateProps {
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyText: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}

// The loading, error and empty states every academy list shares.
export function ListState({ isLoading, error, isEmpty, emptyText, icon: Icon, children }: StateProps) {
  if (isLoading) return <div className="space-y-3" data-testid="state-loading">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (error) {
    return (
      <Card><CardContent className="py-12 text-center text-destructive" data-testid="state-error">
        <TriangleAlert className="w-8 h-8 mx-auto mb-3" />
        <p>{error.message}</p>
      </CardContent></Card>
    );
  }
  if (isEmpty) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground" data-testid="state-empty">
        <Icon className="w-8 h-8 mx-auto mb-3" />
        <p>{emptyText}</p>
      </CardContent></Card>
    );
  }
  return <>{children}</>;
}

interface PickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  placeholder?: string;
  testId: string;
}

// A labelled select. With `allLabel` it's a filter whose first choice clears it.
export function Picker({ label, value, onChange, options, allLabel, placeholder = "Choose", testId }: PickerProps) {
  return (
    <div className="space-y-1">
      {!allLabel && <Label>{label}</Label>}
      <Select value={value || (allLabel ? "all" : "")} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger aria-label={label} data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
      <span className="text-sm">Page {page} of {pages}</span>
      <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></Button>
    </div>
  );
}

const TONES: Record<string, string> = {
  new: "bg-chart-1/10 text-chart-1",
  applied: "bg-chart-1/10 text-chart-1",
  scheduled: "bg-chart-1/10 text-chart-1",
  pending: "bg-chart-1/10 text-chart-1",
  contacted: "bg-chart-3/10 text-chart-3",
  follow_up: "bg-chart-3/10 text-chart-3",
  approved: "bg-chart-3/10 text-chart-3",
  partial: "bg-chart-3/10 text-chart-3",
  converted: "bg-chart-2/10 text-chart-2",
  enrolled: "bg-chart-2/10 text-chart-2",
  paid: "bg-chart-2/10 text-chart-2",
  completed: "bg-chart-2/10 text-chart-2",
  lost: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  overdue: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const text = status.replace(/_/g, " ");
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${TONES[status] || "bg-muted"}`}>{text}</span>;
}
