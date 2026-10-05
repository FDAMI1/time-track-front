import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GraduationCap, TrendingUp, ClipboardList, BarChart3, BookOpen, Target, CheckCircle, XCircle, ExternalLink, FileSpreadsheet, FileText, Calendar } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { useDownload } from "@/mcq/lib/useDownload";
import { isMcqAdmin } from "@/mcq/lib/roles";
import { pctOf, type McqStudentDetail, type McqTeacherPerformance } from "@/mcq/lib/types";
import StatCard from "@/mcq/components/StatCard";
import StudentReportsTable, { useStudentPerformance } from "@/mcq/components/StudentReportsTable";
import { periodLabels, type Period } from "@/mcq/components/PeriodSelect";

const scoreBadge = (score: number): "default" | "secondary" | "destructive" => (score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive");

export default function McqAnalyticsPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const isAdmin = isMcqAdmin(user?.role);
  const { downloading, download } = useDownload();
  const [period, setPeriod] = useState<Period>("monthly");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: students } = useStudentPerformance(period);
  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["/api/mcq/dashboard/teachers", period],
    queryFn: () => api.get<McqTeacherPerformance[]>(`/api/mcq/dashboard/teachers?period=${period}`),
    enabled: isAdmin,
  });
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["/api/mcq/dashboard/students", selectedStudentId, period],
    queryFn: () => api.get<McqStudentDetail>(`/api/mcq/dashboard/students/${selectedStudentId}?period=${period}`),
    enabled: !!selectedStudentId,
  });

  const active = (students || []).filter((s) => s.totalAttempts > 0);
  const studentSummary = {
    total: students?.length || 0,
    active: active.length,
    totalAttempts: (students || []).reduce((s, x) => s + x.totalAttempts, 0),
    avgScore: active.length ? active.reduce((s, x) => s + x.avgScore, 0) / active.length : 0,
  };
  const teacherSummary = {
    total: teachers?.length || 0,
    active: (teachers || []).filter((t) => t.totalTests > 0).length,
    totalTests: (teachers || []).reduce((s, t) => s + t.totalTests, 0),
    totalAttempts: (teachers || []).reduce((s, t) => s + t.totalAttempts, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-analytics-title">Performance Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Track student and teacher performance across your organization</p>
      </div>

      <Tabs defaultValue="students">
        <TabsList data-testid="tabs-analytics">
          <TabsTrigger value="students"><GraduationCap className="w-4 h-4 mr-2" />Students</TabsTrigger>
          {isAdmin && <TabsTrigger value="teachers"><Users className="w-4 h-4 mr-2" />Teachers</TabsTrigger>}
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Students" value={studentSummary.total} icon={<GraduationCap className="w-5 h-5" />} tone="1" />
            <StatCard label="Active Students" value={studentSummary.active} icon={<Target className="w-5 h-5" />} tone="2" hint={`in ${periodLabels[period].toLowerCase()}`} />
            <StatCard label="Total Attempts" value={studentSummary.totalAttempts} icon={<ClipboardList className="w-5 h-5" />} tone="3" hint={`in ${periodLabels[period].toLowerCase()}`} />
            <StatCard label="Avg. Score" value={`${Math.round(studentSummary.avgScore)}%`} icon={<TrendingUp className="w-5 h-5" />} tone="4" />
          </div>
          <StudentReportsTable period={period} onPeriodChange={setPeriod} extended onView={setSelectedStudentId} title="Individual Student Performance" />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="teachers" className="space-y-4 mt-4">
            {teachersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></CardContent></Card>)}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Teachers" value={teacherSummary.total} icon={<Users className="w-5 h-5" />} tone="1" />
                  <StatCard label="Active Teachers" value={teacherSummary.active} icon={<Target className="w-5 h-5" />} tone="2" hint={`created tests in ${periodLabels[period].toLowerCase()}`} />
                  <StatCard label="Tests Created" value={teacherSummary.totalTests} icon={<BookOpen className="w-5 h-5" />} tone="3" hint={`in ${periodLabels[period].toLowerCase()}`} />
                  <StatCard label="Total Attempts" value={teacherSummary.totalAttempts} icon={<ClipboardList className="w-5 h-5" />} tone="4" hint="on their tests" />
                </div>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Individual Teacher Performance</CardTitle></CardHeader>
                  <CardContent>
                    {teachers && teachers.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              {["Teacher", "Tests Created", "Assignments", "Total Attempts", "Submitted", "Avg Student Score"].map((h, i) => <th key={h} className={`py-3 px-3 font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {teachers.map((t) => (
                              <tr key={t.teacherId} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-teacher-${t.teacherId}`}>
                                <td className="py-3 px-3"><p className="font-medium text-foreground">{t.teacherName}</p><p className="text-xs text-muted-foreground">{t.teacherEmail}</p></td>
                                <td className="text-center py-3 px-3 font-medium">{t.totalTests}</td>
                                <td className="text-center py-3 px-3">{t.totalAssignments}</td>
                                <td className="text-center py-3 px-3">{t.totalAttempts}</td>
                                <td className="text-center py-3 px-3">{t.submittedAttempts}</td>
                                <td className="text-center py-3 px-3">{t.totalAttempts > 0 ? <Badge variant={scoreBadge(t.avgStudentScore)}>{Math.round(t.avgStudentScore)}%</Badge> : <span className="text-muted-foreground">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-8">No teachers found</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-primary" />{detail?.student?.name || "Student"} — Test History</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-4">
              {detail?.student && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{detail.student.name?.charAt(0)?.toUpperCase()}</div>
                  <div><p className="font-medium text-foreground">{detail.student.name}</p><p className="text-xs text-muted-foreground">{detail.student.email}</p></div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="outline">{detail.attempts.length} attempts</Badge>
                    <Button variant="outline" size="sm" disabled={downloading === "detail-excel"} onClick={() => download(`/api/mcq/dashboard/students/${selectedStudentId}/download/excel?period=${period}`, "detail-excel")}><FileSpreadsheet className="w-3 h-3 mr-1 text-green-600" />Excel</Button>
                    <Button variant="outline" size="sm" disabled={downloading === "detail-word"} onClick={() => download(`/api/mcq/dashboard/students/${selectedStudentId}/download/word?period=${period}`, "detail-word")}><FileText className="w-3 h-3 mr-1 text-blue-600" />Word</Button>
                  </div>
                </div>
              )}
              {detail && detail.attempts.length > 0 ? (
                <div className="space-y-3">
                  {detail.attempts.map((a) => {
                    const pct = pctOf(a.score, a.totalMarks);
                    const isSubmitted = !!a.submittedAt;
                    return (
                      <div key={a.attemptId} className="border border-border rounded-lg p-4 space-y-2" data-testid={`card-attempt-${a.attemptId}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="font-medium text-foreground">{a.testTitle}</p>{a.testDescription && <p className="text-xs text-muted-foreground">{a.testDescription}</p>}</div>
                          {isSubmitted ? <Badge variant={scoreBadge(pct)}>{a.score}/{a.totalMarks} ({pct}%)</Badge> : <Badge variant="outline">In Progress</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(a.startedAt).toLocaleDateString()}</span>
                          {isSubmitted ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />Submitted {new Date(a.submittedAt!).toLocaleString()}</span> : <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-orange-500" />Not submitted</span>}
                        </div>
                        {isSubmitted && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></div>
                            <Link href={`/results/${a.attemptId}`} onClick={() => setSelectedStudentId(null)}><Button variant="ghost" size="sm" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />View Answers</Button></Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">No attempts found for {periodLabels[period].toLowerCase()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
