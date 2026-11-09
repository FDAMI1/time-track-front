import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart3, Trophy, Target, TrendingUp, Search, User, Eye, Trash2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { isMcqStaff } from "@/mcq/lib/roles";
import { pctOf, scoreVariant, type McqAttemptSummary } from "@/mcq/lib/types";
import StatCard from "@/mcq/components/StatCard";
import PeriodSelect, { periodLabels, type Period } from "@/mcq/components/PeriodSelect";

function StaffResults() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams({ period });
  if (search.trim()) params.set("search", search.trim());
  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/attempts", period, search],
    queryFn: () => api.get<McqAttemptSummary[]>(`/api/mcq/attempts?${params}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/attempts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/attempts"] }); toast({ title: "Record deleted", description: "The test record and its screenshots have been permanently removed." }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attempts = data || [];
  const totalScore = attempts.reduce((s, a) => s + (a.score || 0), 0);
  const totalMarks = attempts.reduce((s, a) => s + (a.totalMarks || 0), 0);
  const avgPct = pctOf(totalScore, totalMarks);
  const uniqueStudents = new Set(attempts.map((a) => a.studentId)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title" data-testid="text-results-title">Student Results</h1>
        <p className="text-muted-foreground text-sm mt-1">View individual student performance and answer breakdowns</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by student name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-student" />
        </div>
        <PeriodSelect value={period} onChange={setPeriod} className="w-full sm:w-[180px]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Results" value={attempts.length} icon={<Target className="w-5 h-5" />} tone="1" hint={periodLabels[period].toLowerCase()} testId="text-total-results" />
        <StatCard label="Students" value={uniqueStudents} icon={<User className="w-5 h-5" />} tone="2" hint="unique students" />
        <StatCard label="Avg Score" value={`${avgPct}%`} icon={<TrendingUp className="w-5 h-5" />} tone="3" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : attempts.length > 0 ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Individual Results</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Student", "Test", "Score", "Percentage", "Date", "Actions"].map((h, i) => <th key={h} className={`py-3 px-3 font-medium text-muted-foreground ${i < 2 ? "text-left" : "text-center"}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const pct = pctOf(a.score, a.totalMarks);
                    return (
                      <tr key={a._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-result-${a._id}`}>
                        <td className="py-3 px-3"><p className="font-medium text-foreground">{a.studentName}</p><p className="text-xs text-muted-foreground">{a.studentEmail}</p></td>
                        <td className="py-3 px-3"><p className="font-medium text-foreground">{a.testTitle}</p>{a.testDescription && <p className="text-xs text-muted-foreground">{a.testDescription}</p>}</td>
                        <td className="text-center py-3 px-3 font-medium">{a.score}/{a.totalMarks}</td>
                        <td className="text-center py-3 px-3"><Badge variant={a.proctorStatus === "FLAGGED" ? "destructive" : scoreVariant(pct)}>{a.proctorStatus === "FLAGGED" ? "Terminated" : `${pct}%`}</Badge></td>
                        <td className="text-center py-3 px-3 text-xs text-muted-foreground">{a.submittedAt && new Date(a.submittedAt).toLocaleDateString()}</td>
                        <td className="text-center py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/results/${a._id}`}><Button variant="ghost" size="sm" data-testid={`button-view-result-${a._id}`}><Eye className="w-4 h-4 mr-1" />View</Button></Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-attempt-${a._id}`}><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Test Record</AlertDialogTitle>
                                  <AlertDialogDescription>This permanently deletes the record for {a.studentName} ({a.testTitle}), including proctoring screenshots. This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remove.mutate(a._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-12 text-center"><BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No results found</p><p className="text-muted-foreground/70 text-xs mt-1">{search ? "Try a different search term" : "No student submissions yet"}</p></CardContent></Card>
      )}
    </div>
  );
}

function TakerResults() {
  const api = useMcqApi();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/student/attempts"],
    queryFn: () => api.get<McqAttemptSummary[]>("/api/mcq/student/attempts"),
  });

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div></div>;

  const submitted = (data || []).filter((a) => a.submittedAt);
  // Results the teacher has not published yet carry no score and stay out of the averages.
  const scored = submitted.filter((a) => !a.resultsHidden);
  const totalScore = scored.reduce((s, a) => s + (a.score || 0), 0);
  const totalMarks = scored.reduce((s, a) => s + (a.totalMarks || 0), 0);
  const best = scored.length ? Math.max(...scored.map((a) => pctOf(a.score, a.totalMarks))) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">My Results</h1><p className="text-muted-foreground text-sm mt-1">{submitted.length} completed test(s)</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Average Score" value={`${pctOf(totalScore, totalMarks)}%`} icon={<TrendingUp className="w-5 h-5" />} tone="1" />
        <StatCard label="Best Score" value={`${best}%`} icon={<Trophy className="w-5 h-5" />} tone="2" />
        <StatCard label="Tests Taken" value={submitted.length} icon={<Target className="w-5 h-5" />} tone="3" />
      </div>
      {submitted.length > 0 ? (
        <div className="space-y-3">
          {submitted.map((a) => {
            const pct = pctOf(a.score, a.totalMarks);
            return (
              <Link key={a._id} href={`/results/${a._id}`}>
                <Card className="cursor-pointer hover-elevate">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground" data-testid={`text-result-test-${a._id}`}>{a.testTitle || "Test"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.resultsHidden ? "Result pending" : <>Score: {a.score}/{a.totalMarks}</>} | {a.submittedAt && new Date(a.submittedAt).toLocaleDateString()}{a.assignedBy && <> | Assigned by: <span className="font-medium">{a.assignedBy}</span></>}</p>
                      </div>
                      {a.resultsHidden
                        ? <Badge variant="secondary" data-testid={`badge-result-pending-${a._id}`}>Pending</Badge>
                        : <Badge variant={a.proctorStatus === "FLAGGED" ? "destructive" : scoreVariant(pct)}>{a.proctorStatus === "FLAGGED" ? "Terminated" : `${pct}%`}</Badge>}
                    </div>
                    {!a.resultsHidden && <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 70 ? "bg-chart-2" : pct >= 40 ? "bg-chart-4" : "bg-destructive"}`} style={{ width: `${pct}%` }} /></div>}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="p-12 text-center"><BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No results yet</p><p className="text-muted-foreground/70 text-xs mt-1">Complete a test to see your results</p></CardContent></Card>
      )}
    </div>
  );
}

export default function McqResultsPage() {
  const { user } = useAuth();
  return isMcqStaff(user) ? <StaffResults /> : <TakerResults />;
}
