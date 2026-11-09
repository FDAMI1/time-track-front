import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Trophy, Clock, Target } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { pctOf, scoreVariant, type McqAssignment, type McqAttemptSummary } from "@/mcq/lib/types";
import StatCard from "@/mcq/components/StatCard";

export default function TakerDashboard() {
  const api = useMcqApi();
  const { user } = useAuth();

  const { data: assignments, isLoading: aLoading } = useQuery({
    queryKey: ["/api/mcq/student/assignments"],
    queryFn: () => api.get<McqAssignment[]>("/api/mcq/student/assignments"),
  });
  const { data: attempts, isLoading: tLoading } = useQuery({
    queryKey: ["/api/mcq/student/attempts"],
    queryFn: () => api.get<McqAttemptSummary[]>("/api/mcq/student/attempts"),
  });

  if (aLoading || tLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const list = assignments || [];
  const pending = list.filter((a) => a.status === "ASSIGNED" && a.test?.status === "ACTIVE");
  const completed = list.filter((a) => a.status === "COMPLETED").length;
  const submitted = (attempts || []).filter((a) => a.submittedAt);
  const scored = submitted.filter((a) => !a.resultsHidden);
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, a) => s + pctOf(a.score, a.totalMarks), 0) / scored.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title" data-testid="text-mcq-dashboard-title">Welcome, {user?.firstName}</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your progress and take assigned tests</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending Tests" value={list.filter((a) => a.status === "ASSIGNED").length} icon={<Clock className="w-5 h-5" />} tone="4" />
        <StatCard label="Completed" value={completed} icon={<Target className="w-5 h-5" />} tone="2" />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon={<Trophy className="w-5 h-5" />} tone="1" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" />Pending Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length > 0 ? (
            <div className="space-y-3">
              {pending.map((a) => (
                <div key={a._id} className="flex items-center justify-between gap-2 py-3 px-3 rounded-md bg-muted/30" data-testid={`assignment-item-${a._id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.test?.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Duration: {a.test?.duration} min | Max attempts: {a.test?.maxAttempts}</p>
                  </div>
                  <Link href={`/take-test/${a.test?._id}`}><Button size="sm" data-testid={`button-start-test-${a.test?._id}`}>Start Test</Button></Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No pending tests</p>
              <p className="text-muted-foreground/70 text-xs mt-1">You're all caught up!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {submitted.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {submitted.slice(0, 5).map((a) => {
                const pct = pctOf(a.score, a.totalMarks);
                return (
                  <Link key={a._id} href={`/results/${a._id}`}>
                    <div className="flex items-center justify-between gap-2 py-2 px-2 cursor-pointer hover-elevate rounded-md" data-testid={`result-item-${a._id}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.testTitle || "Test"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.resultsHidden ? "Result pending" : <>Score: {a.score}/{a.totalMarks}</>}
                          {a.assignedBy && <> | By: {a.assignedBy}</>}
                        </p>
                      </div>
                      {a.resultsHidden ? <Badge variant="secondary">Pending</Badge> : <Badge variant={scoreVariant(pct)}>{pct}%</Badge>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
