import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RemoteImage } from "@/components/remote-image";
import { formatMoney } from "@/academy/lib/academy";
import { VIA, person, topicState, type StudentProgress } from "@/academy/lib/progress";
import { LectureHistoryCard, RecoveryHistoryCard } from "@/academy/components/LectureHistory";

// One student's progress: profile, each course's portion, pending (missed) topics first,
// every topic with its original and actual dates, and the lecture history.
export default function StudentProgressView({ data, canEdit }: { data: StudentProgress; canEdit: boolean }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const s = data.student;
  const pending = data.topics.filter((t) => t.status === "pending");

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "pending" }) => api.put(`/api/progress/student-topics/${id}`, { status, note }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/progress"] }); setEditing(null); setNote(""); toast({ title: "Progress updated" }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="student-progress">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 text-lg font-semibold">
            <RemoteImage src={s.photoUrl || ""} alt={person(s)} className="w-full h-full object-cover" fallback={<span>{(s.firstName?.[0] || "") + (s.lastName?.[0] || "")}</span>} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold" data-testid="text-progress-student">{person(s)}</p>
            <p className="text-sm text-muted-foreground break-all">ID {s.userId || "—"} · @{s.username}{s.email ? ` · ${s.email}` : ""}</p>
            {s.createdAt && <p className="text-xs text-muted-foreground">Enrolled {new Date(s.createdAt).toLocaleDateString()}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div><p className="text-muted-foreground text-xs">Fees paid</p><p className="font-semibold">{formatMoney(data.fees.paid)}</p></div>
            <div><p className="text-muted-foreground text-xs">Balance</p><p className="font-semibold">{formatMoney(data.fees.balance)}</p></div>
            <div><p className="text-muted-foreground text-xs">Days present</p><p className="font-semibold">{data.dailyAttendance.present || 0}/{data.dailyAttendance.total || 0}</p></div>
          </div>
        </CardContent>
      </Card>

      {!data.courses.length && <p className="text-sm text-muted-foreground">Not in any batch yet.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.courses.map((c) => (
          <Card key={c.batchId} data-testid={`card-course-${c.batchId}`}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{c.course} <span className="text-muted-foreground font-normal text-sm">· {c.batchName}</span></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3"><Progress value={c.progress} className="flex-1" aria-label="Course progress" /><span className="font-semibold text-sm" data-testid={`text-progress-${c.batchId}`}>{c.progress}%</span></div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                <div><p className="text-lg font-semibold">{c.totalPortion}</p>Total</div>
                <div><p className="text-lg font-semibold text-green-700 dark:text-green-400">{c.completed}</p>Completed</div>
                <div><p className="text-lg font-semibold text-amber-600">{c.pending}</p>Pending</div>
                <div><p className="text-lg font-semibold text-destructive" data-testid={`text-recovery-${c.batchId}`}>{c.recoveryRequired ?? 0}</p>Recovery</div>
                <div><p className="text-lg font-semibold">{c.notYetTaught}</p>Not started</div>
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`text-lectures-${c.batchId}`}>
                Lectures assigned {c.lecturesAssigned ?? "—"} · attended {c.lecturesAttended} · missed {c.lecturesMissed} · recoveries completed {c.makeups}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!!pending.length && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-base">Pending portions ({pending.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm" data-testid="list-pending-portions">
              {pending.map((t) => <li key={t._id}>{t.subject ? `${t.subject} · ` : ""}<span className="font-medium">{t.topicTitle}</span> <span className="text-muted-foreground">— {t.recoveryRequired ? "missed on" : "pending since"} {t.originalDate}</span>{t.recoveryRequired && <Badge variant="outline" className="ml-2 text-destructive text-[10px]">Recovery Required</Badge>}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Topics</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!data.topics.length ? <p className="text-sm text-muted-foreground">No lectures recorded in these dates.</p> : (
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2 pr-2">Topic</th><th className="pr-2">Lecture date</th><th className="pr-2">Lecturer</th><th className="pr-2">Status</th><th className="pr-2">Completed on</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {data.topics.map((t) => (
                  <tr key={t._id} className="border-b last:border-0 align-top" data-testid={`row-topic-${t._id}`}>
                    <td className="py-2 pr-2">{t.subject && <span className="text-xs text-muted-foreground block">{t.subject}</span>}{t.topicTitle}</td>
                    <td className="pr-2 whitespace-nowrap">{t.originalDate}</td>
                    <td className="pr-2">{person(t.lecturerId)}</td>
                    <td className="pr-2"><Badge variant="outline" className={t.status === "completed" ? "text-green-700 dark:text-green-400" : t.recoveryRequired ? "text-destructive" : "text-amber-600"}>{topicState(t)}</Badge></td>
                    <td className="pr-2 whitespace-nowrap">{t.completedDate || "Not completed"}{t.completedVia && <span className="block text-xs text-muted-foreground">{VIA[t.completedVia]}</span>}</td>
                    {canEdit && (
                      <td className="py-2">
                        {editing === t._id ? (
                          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); change.mutate({ id: t._id, status: t.status === "completed" ? "pending" : "completed" }); }}>
                            <Input className="h-8 w-40" placeholder="Why?" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason" data-testid={`input-topic-note-${t._id}`} />
                            <Button type="submit" size="sm" className="h-8" disabled={!note.trim() || change.isPending}>Save</Button>
                          </form>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(t._id); setNote(""); }} data-testid={`button-topic-${t._id}`}>
                            {t.status === "completed" ? "Reopen" : "Mark completed"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data.mcq && !!data.mcq.assigned && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">MCQ tests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground" data-testid="text-mcq-summary">{data.mcq.assigned} assigned · {data.mcq.completed} completed · {data.mcq.pending} pending{data.mcq.missed ? ` · ${data.mcq.missed} missed` : ""}</p>
            <ul className="divide-y text-sm" data-testid="list-mcq-tests">
              {data.mcq.tests.map((t) => (
                <li key={t.testId} className="py-2 flex justify-between gap-2 flex-wrap">
                  <span>{t.title}{t.lastAttemptAt && <span className="block text-xs text-muted-foreground">Last attempt {new Date(t.lastAttemptAt).toLocaleDateString()}</span>}</span>
                  <span className="text-right">
                    <Badge variant="outline" className="capitalize">{t.state}</Badge>
                    {t.totalMarks ? <span className="block text-xs mt-0.5">{t.score}/{t.totalMarks} ({t.percentage}%)</span> : t.result ? <span className="block text-xs text-muted-foreground mt-0.5">Result {t.result}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <LectureHistoryCard attendance={data.attendance} />
      <RecoveryHistoryCard attendance={data.attendance} />
    </div>
  );
}
