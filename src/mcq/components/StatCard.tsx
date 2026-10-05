import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "1" | "2" | "3" | "4" | "5";
  hint?: string;
  testId?: string;
}

// Literal class strings so Tailwind's JIT scanner can see them.
const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  "1": "bg-chart-1/10 text-chart-1",
  "2": "bg-chart-2/10 text-chart-2",
  "3": "bg-chart-3/10 text-chart-3",
  "4": "bg-chart-4/10 text-chart-4",
  "5": "bg-chart-5/10 text-chart-5",
};

export default function StatCard({ label, value, icon, tone = "1", hint, testId }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-1 mb-3">
          <span className="text-sm text-muted-foreground font-medium">{label}</span>
          <div className={`w-9 h-9 rounded-lg ${TONES[tone]} flex items-center justify-center`}>{icon}</div>
        </div>
        <p className="text-3xl font-bold text-foreground" data-testid={testId}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
