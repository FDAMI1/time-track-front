import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, ClipboardList, FileText, TrendingUp, BookOpen } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqStats } from "@/mcq/lib/types";
import StatCard from "@/mcq/components/StatCard";
import StudentReportsTable from "@/mcq/components/StudentReportsTable";
import type { Period } from "@/mcq/components/PeriodSelect";

interface ActivityLog {
  _id: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const api = useMcqApi();
  const [period, setPeriod] = useState<Period>("monthly");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/mcq/dashboard/stats"],
    queryFn: () => api.get<McqStats>("/api/mcq/dashboard/stats"),
  });

  // Existing activity-log endpoint; MCQ actions are prefixed with "mcq_".
  const { data: logs } = useQuery({
    queryKey: ["/api/activity-logs", "mcq-recent"],
    queryFn: () => api.get<{ logs: ActivityLog[] }>("/api/activity-logs?limit=50"),
  });
  const recent = (logs?.logs || []).filter((l) => l.action.startsWith("mcq_")).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-mcq-dashboard-title">MCQ Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of tests, questions and student performance</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Teachers" value={stats?.totalTeachers || 0} icon={<Users className="w-5 h-5" />} tone="1" testId="stat-teachers" />
          <StatCard label="Students" value={stats?.totalStudents || 0} icon={<GraduationCap className="w-5 h-5" />} tone="2" testId="stat-students" />
          <StatCard label="Tests" value={stats?.totalTests || 0} icon={<ClipboardList className="w-5 h-5" />} tone="3" testId="stat-tests" />
          <StatCard label="Attempts" value={stats?.totalAttempts || 0} icon={<FileText className="w-5 h-5" />} tone="4" testId="stat-attempts" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Average Score</span>
              <span className="text-lg font-semibold text-foreground" data-testid="text-avg-score">{Math.round(stats?.avgScore || 0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round(stats?.avgScore || 0))}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />Recent MCQ Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((log) => (
                  <div key={log._id} className="flex items-start gap-3 text-sm" data-testid={`log-item-${log._id}`}>
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{log.action.replace(/^mcq_/, "").replace(/_/g, " ")}</p>
                      <p className="text-muted-foreground text-xs truncate">{log.details || new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent MCQ activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      <StudentReportsTable period={period} onPeriodChange={setPeriod} />
    </div>
  );
}
