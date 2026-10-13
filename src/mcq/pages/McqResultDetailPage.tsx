import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, ShieldAlert, AlertTriangle, ImageIcon, Trash2 } from "lucide-react";
import { screenshotUrl, useMcqApi } from "@/mcq/lib/api";
import { isMcqStaff } from "@/mcq/lib/roles";
import { pctOf, VIOLATION_LABELS, type McqAttemptDetail } from "@/mcq/lib/types";

export default function McqResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useMcqApi();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isStaff = isMcqStaff(user?.role);
  const [screenshot, setScreenshot] = useState<{ fileId: string; label: string } | null>(null);

  const url = isStaff ? `/api/mcq/attempts/${id}` : `/api/mcq/student/attempts/${id}`;
  const queryKey = [isStaff ? "/api/mcq/attempts" : "/api/mcq/student/attempts", id];
  const { data: attempt, isLoading } = useQuery({ queryKey, queryFn: () => api.get<McqAttemptDetail>(url) });

  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });
  const deleteAttempt = useMutation({
    mutationFn: () => api.delete(`/api/mcq/attempts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/attempts"] }); toast({ title: "Record deleted" }); navigate("/results"); },
    onError,
  });
  const deleteScreenshot = useMutation({
    mutationFn: (fileId: string) => api.delete(`/api/mcq/attempts/${id}/screenshots/${fileId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Screenshot deleted" }); },
    onError,
  });

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!attempt) return <div className="text-muted-foreground">Result not found</div>;

  if (attempt.resultsHidden) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/results"><Button size="icon" variant="ghost" data-testid="button-back"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-foreground">Result Details</h1>
        </div>
        <Card><CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-result-pending">
          This result has not been published yet. It will appear here once your teacher publishes it.
        </CardContent></Card>
      </div>
    );
  }

  const pct = pctOf(attempt.score, attempt.totalMarks);
  const answers = attempt.answers || [];
  const correct = answers.filter((a) => a.isCorrect).length;
  const wrong = answers.filter((a) => a.selectedAnswer !== null && !a.isCorrect).length;
  const skipped = answers.filter((a) => a.selectedAnswer === null).length;
  const proctorLog = attempt.proctorLog || [];
  const flagged = attempt.proctorStatus === "FLAGGED";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/results"><Button size="icon" variant="ghost" data-testid="button-back"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-foreground">Result Details</h1>
        </div>
        {isStaff && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm" data-testid="button-delete-attempt"><Trash2 className="w-4 h-4 mr-1" />Delete Record</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Test Record</AlertDialogTitle><AlertDialogDescription>This permanently deletes this test record including all proctoring screenshots. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteAttempt.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {(attempt.student || attempt.test) && (
        <Card>
          <CardContent className="p-5 flex items-center gap-3 flex-wrap">
            {attempt.student && (
              <>
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{attempt.student.name?.charAt(0)?.toUpperCase()}</div>
                <div><p className="font-medium text-foreground" data-testid="text-student-name">{attempt.student.name}</p><p className="text-xs text-muted-foreground">{attempt.student.email}</p></div>
              </>
            )}
            {attempt.test && (
              <div className="ml-auto text-right"><p className="text-sm font-medium text-foreground" data-testid="text-test-name">{attempt.test.title}</p>{attempt.test.description && <p className="text-xs text-muted-foreground">{attempt.test.description}</p>}</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><p className="text-sm text-muted-foreground">Score</p><p className="text-4xl font-bold text-foreground" data-testid="text-score">{attempt.score}/{attempt.totalMarks}</p></div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${pct >= 70 ? "bg-chart-2/10" : pct >= 40 ? "bg-chart-4/10" : "bg-destructive/10"}`}>
              <span className={`text-2xl font-bold ${pct >= 70 ? "text-chart-2" : pct >= 40 ? "text-chart-4" : "text-destructive"}`}>{pct}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="text-center p-3 rounded-md bg-chart-2/5"><CheckCircle2 className="w-5 h-5 text-chart-2 mx-auto mb-1" /><p className="text-lg font-bold text-foreground">{correct}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div className="text-center p-3 rounded-md bg-destructive/5"><XCircle className="w-5 h-5 text-destructive mx-auto mb-1" /><p className="text-lg font-bold text-foreground">{wrong}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
            <div className="text-center p-3 rounded-md bg-muted/50"><MinusCircle className="w-5 h-5 text-muted-foreground mx-auto mb-1" /><p className="text-lg font-bold text-foreground">{skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
          </div>
        </CardContent>
      </Card>

      {(proctorLog.length > 0 || (attempt.proctorStatus && attempt.proctorStatus !== "CLEAN")) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className={`w-5 h-5 ${flagged ? "text-destructive" : "text-amber-500"}`} />
              <h3 className="text-sm font-semibold text-foreground">Proctoring Report</h3>
              <Badge variant={flagged ? "destructive" : "secondary"} className="text-[10px]" data-testid="badge-proctor-status">{flagged ? "Terminated" : "Warned"}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2 rounded-md bg-muted/30 text-center"><p className="text-lg font-bold text-foreground">{attempt.proctorWarnings || 0}</p><p className="text-xs text-muted-foreground">Total Warnings</p></div>
              <div className="p-2 rounded-md bg-muted/30 text-center"><p className="text-lg font-bold text-foreground">{attempt.test?.proctorWarningLimit || 5}</p><p className="text-xs text-muted-foreground">Warning Limit</p></div>
            </div>
            {proctorLog.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Violation Log</p>
                {proctorLog.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded-md bg-destructive/5 border border-destructive/10" data-testid={`proctor-log-entry-${idx}`}>
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{VIOLATION_LABELS[entry.type] || entry.type}</span>
                      <span className="text-muted-foreground ml-2">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      {entry.message && <p className="text-muted-foreground mt-0.5">{entry.message}</p>}
                      {entry.screenshotFileId && (
                        <div className="flex items-center gap-3 mt-1">
                          <button type="button" onClick={() => setScreenshot({ fileId: entry.screenshotFileId!, label: `${VIOLATION_LABELS[entry.type] || entry.type} - ${new Date(entry.timestamp).toLocaleTimeString()}` })} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid={`link-screenshot-${idx}`}>
                            <ImageIcon className="w-3 h-3" />View Screen Capture
                          </button>
                          {isStaff && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild><button type="button" className="inline-flex items-center gap-1 text-destructive hover:underline"><Trash2 className="w-3 h-3" />Delete</button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Screenshot</AlertDialogTitle><AlertDialogDescription>This permanently deletes this proctoring screenshot. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteScreenshot.mutate(entry.screenshotFileId!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {answers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Answer Breakdown</h2>
          {answers.map((ans, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ans.selectedAnswer === null ? "bg-muted text-muted-foreground" : ans.isCorrect ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
                    {ans.selectedAnswer === null ? <MinusCircle className="w-4 h-4" /> : ans.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium text-foreground">{idx + 1}. {ans.questionText}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ans.options.map((opt, i) => {
                        const isCorrect = i === ans.correctAnswer;
                        const isSelected = i === ans.selectedAnswer;
                        const cls = isCorrect ? "bg-chart-2/10 text-chart-2 font-medium" : isSelected ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground";
                        return <div key={i} className={`text-xs px-2.5 py-1.5 rounded-md ${cls}`}>{String.fromCharCode(65 + i)}. {opt}{isCorrect && " (correct)"}{isSelected && !isCorrect && " (your answer)"}</div>;
                      })}
                    </div>
                    <p className={`text-xs ${ans.marksAwarded >= 0 ? "text-chart-2" : "text-destructive"}`}>{ans.marksAwarded >= 0 ? "+" : ""}{ans.marksAwarded} marks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!screenshot} onOpenChange={(open) => !open && setScreenshot(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" />{screenshot?.label || "Screen Capture"}</DialogTitle></DialogHeader>
          {screenshot && <img src={screenshotUrl(screenshot.fileId, token)} alt="Proctor violation screenshot" className="max-w-full rounded-lg border border-border mx-auto" data-testid="img-screenshot-preview" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
