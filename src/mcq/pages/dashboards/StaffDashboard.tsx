import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ClipboardList, FileCheck, BarChart3, BookOpen, FileText, TrendingUp, Clock } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { MCQ_TAKER_ROLES } from "@/mcq/lib/roles";
import { pctOf, type McqAttemptSummary, type McqQuestion, type McqTest, type OrgUser } from "@/mcq/lib/types";
import StatCard from "@/mcq/components/StatCard";
import StudentReportsTable from "@/mcq/components/StudentReportsTable";
import type { Period } from "@/mcq/components/PeriodSelect";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function StaffDashboard() {
  const api = useMcqApi();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("monthly");

  const { data: users, isLoading: uLoading } = useQuery<OrgUser[]>({ queryKey: ["/api/users"] });
  const { data: tests, isLoading: tLoading } = useQuery({
    queryKey: ["/api/mcq/tests", "dashboard"],
    queryFn: () => api.get<{ tests: McqTest[]; total: number }>("/api/mcq/tests?limit=100"),
  });
  const { data: questions, isLoading: qLoading } = useQuery({
    queryKey: ["/api/mcq/questions", "count"],
    queryFn: () => api.get<{ questions: McqQuestion[]; total: number }>("/api/mcq/questions?limit=1"),
  });
  const { data: attempts, isLoading: aLoading } = useQuery({
    queryKey: ["/api/mcq/attempts", "dashboard"],
    queryFn: () => api.get<McqAttemptSummary[]>("/api/mcq/attempts?period=all"),
  });

  if (uLoading || tLoading || qLoading || aLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const students = (users || []).filter((u) => MCQ_TAKER_ROLES.includes(u.role) && u.isActive);
  const testList = tests?.tests || [];
  const activeTests = testList.filter((t) => t.status === "ACTIVE").length;
  const draftTests = testList.filter((t) => t.status === "DRAFT").length;
  const recent = attempts || [];
  const avgScore = recent.length > 0 ? Math.round(recent.reduce((s, a) => s + pctOf(a.score, a.totalMarks), 0) / recent.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-mcq-dashboard-title">Welcome, {user?.firstName}</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your question bank, tests and results</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/questions"><Button variant="secondary" data-testid="link-question-bank"><BookOpen className="w-4 h-4 mr-2" />Question Bank</Button></Link>
          <Link href="/tests"><Button data-testid="link-create-test"><ClipboardList className="w-4 h-4 mr-2" />Create Test</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="My Students" value={students.length} icon={<GraduationCap className="w-5 h-5" />} tone="1" />
        <StatCard label="Questions" value={questions?.total || 0} icon={<BookOpen className="w-5 h-5" />} tone="4" />
        <StatCard label="Tests" value={tests?.total || 0} icon={<ClipboardList className="w-5 h-5" />} tone="3" />
        <StatCard label="Active Tests" value={activeTests} icon={<FileCheck className="w-5 h-5" />} tone="2" />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon={<TrendingUp className="w-5 h-5" />} tone="5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Recent Submissions</CardTitle>
              {recent.length > 0 && <Link href="/results"><Button variant="ghost" size="sm" className="text-xs">View All</Button></Link>}
            </div>
          </CardHeader>
          <CardContent>
            {recent.length > 0 ? (
              <div className="space-y-1">
                {recent.slice(0, 6).map((a) => {
                  const pct = pctOf(a.score, a.totalMarks);
                  return (
                    <Link key={a._id} href={`/results/${a._id}`}>
                      <div className="flex items-center justify-between gap-2 py-2 px-2 cursor-pointer hover-elevate rounded-md" data-testid={`attempt-item-${a._id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{a.studentName}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.testTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>{a.score}/{a.totalMarks}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{timeAgo(a.submittedAt)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8"><FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground text-sm">No submissions yet</p></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />My Tests</CardTitle>
              {testList.length > 0 && <Link href="/tests"><Button variant="ghost" size="sm" className="text-xs">View All</Button></Link>}
            </div>
            {testList.length > 0 && (
              <div className="flex gap-3 mt-2">
                <Badge variant="default" className="text-xs">{activeTests} Active</Badge>
                <Badge variant="secondary" className="text-xs">{draftTests} Draft</Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {testList.length > 0 ? (
              <div className="space-y-1">
                {testList.slice(0, 6).map((t) => {
                  const completions = recent.filter((a) => a.testId === t._id).length;
                  return (
                    <Link key={t._id} href={`/tests/${t._id}`}>
                      <div className="flex items-center justify-between gap-2 py-2 px-2 cursor-pointer hover-elevate rounded-md" data-testid={`test-item-${t._id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{t.duration} min{completions > 0 && ` · ${completions} submission${completions !== 1 ? "s" : ""}`}</p>
                        </div>
                        <Badge variant={t.status === "ACTIVE" ? "default" : "secondary"} className="shrink-0">{t.status}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No tests created yet</p>
                <Link href="/tests"><Button variant="outline" size="sm" className="mt-3">Create Your First Test</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StudentReportsTable period={period} onPeriodChange={setPeriod} />
    </div>
  );
}
