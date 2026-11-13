import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Briefcase, Clock, Coffee, GraduationCap, Hourglass, Sigma } from "lucide-react";

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
};

function Stat({ label, value, note, icon, tint, testId }: { label: string; value: string; note?: ReactNode; icon: ReactNode; tint: string; testId: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1" data-testid={testId}>{value}</p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tint}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface TimeSummary {
  approvedMinutes: number;
  pendingMinutes: number;
  totalTasks: number;
  productionMinutes: number;
  lectureMinutes: number;
  breakMinutes: number;
  lectureNote: ReactNode;
  breakNote: ReactNode;
}

// Production is work only; lecture and break are tracked apart. Total time spent adds the three.
export default function TimeSummaryCards({ s }: { s: TimeSummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <Stat label="Approved Production" value={formatDuration(s.approvedMinutes)} icon={<Clock className="w-5 h-5 text-primary" />} tint="bg-primary/10" testId="text-total-time" />
      <Stat label="Waiting for Approval" value={formatDuration(s.pendingMinutes)} icon={<Hourglass className="w-5 h-5 text-amber-600" />} tint="bg-amber-500/10" testId="text-pending-time" />
      <Stat label="Total Tasks" value={String(s.totalTasks)} icon={<BarChart3 className="w-5 h-5 text-chart-3" />} tint="bg-chart-3/10" testId="text-unique-tasks" />
      <Stat label="Total Production Time" value={formatDuration(s.productionMinutes)} icon={<Briefcase className="w-5 h-5 text-sky-600" />} tint="bg-sky-500/10" testId="text-production-time" />
      <Stat label="Total Lecture Time" value={formatDuration(s.lectureMinutes)} note={s.lectureNote} icon={<GraduationCap className="w-5 h-5 text-violet-600" />} tint="bg-violet-500/10" testId="text-lecture-time" />
      <Stat label="Total Break Time" value={formatDuration(s.breakMinutes)} note={s.breakNote} icon={<Coffee className="w-5 h-5 text-red-600" />} tint="bg-red-500/10" testId="text-break-time" />
      <Stat
        label="Total Time Spent"
        value={formatDuration(s.productionMinutes + s.lectureMinutes + s.breakMinutes)}
        note="Production + Lecture + Break"
        icon={<Sigma className="w-5 h-5 text-emerald-600" />}
        tint="bg-emerald-500/10"
        testId="text-total-spent"
      />
    </div>
  );
}
