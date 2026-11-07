import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { localToday, nameOf, type Lecture, type Person } from "@/academy/lib/academy";

interface Row {
  student: Person & { userId?: string };
  status: "present" | "absent" | null;
  changes: { from: string; to: string; byName?: string; at: string }[];
  makeup: { date: string; notes: string } | null;
}

// The lecturer marks every student of the batch. Absent students get the topic as a pending
// portion automatically; a make-up later completes it on the day they actually attend.
export default function LectureAttendanceDialog({ lecture, onClose }: { lecture: Lecture; onClose: () => void }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const key = ["/api/lectures", lecture._id, "attendance"];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<{ students: Row[]; today: string }>(`/api/lectures/${lecture._id}/attendance`) });
  const [marks, setMarks] = useState<Record<string, "present" | "absent">>({});
  const [makeupFor, setMakeupFor] = useState<string | null>(null);
  const [makeup, setMakeup] = useState({ date: localToday(), notes: "" });

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.filter((r) => r.status).map((r) => [r.student._id, r.status as "present" | "absent"])));
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
  };
  const save = useMutation({
    mutationFn: () => api.post(`/api/lectures/${lecture._id}/attendance`, { records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }),
    onSuccess: () => { refresh(); toast({ title: "Attendance saved", description: "Absent students now have this topic as a pending portion." }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });
  const saveMakeup = useMutation({
    mutationFn: (studentId: string) => api.post(`/api/lectures/${lecture._id}/makeup`, { studentId, ...makeup }),
    onSuccess: () => { refresh(); setMakeupFor(null); toast({ title: "Make-up recorded", description: "The topic is completed on the make-up date; the original absence stays." }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  // "Today" is the organization's date (its time zone), which is what the server checks.
  const today = data?.today || localToday();
  const rows = data?.students || [];
  const future = lecture.date > today;
  const unmarked = rows.filter((r) => !marks[r.student._id]).length;
  const saved = Object.fromEntries(rows.map((r) => [r.student._id, r.status]));
  const dirty = rows.some((r) => marks[r.student._id] && marks[r.student._id] !== saved[r.student._id]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance · {lecture.title}</DialogTitle>
          <DialogDescription>
            {lecture.batchId?.batchName} · {lecture.date} {lecture.startTime}–{lecture.endTime}
            {lecture.subject ? ` · ${lecture.subject}` : ""}{lecture.portion ? ` · ${lecture.portion}` : ""}
          </DialogDescription>
        </DialogHeader>
        {future && <p className="text-sm text-muted-foreground" data-testid="text-attendance-future">Attendance opens on the lecture date. Today is {today} in your organization's time zone.</p>}
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && !rows.length && <p className="text-sm text-muted-foreground">This batch has no students yet.</p>}
        {!!rows.length && !future && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground" data-testid="text-attendance-count">
                {rows.length} students · {Object.values(marks).filter((m) => m === "present").length} present · {Object.values(marks).filter((m) => m === "absent").length} absent{unmarked ? ` · ${unmarked} not marked` : ""}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.student._id, "present"])))} data-testid="button-all-present">All present</Button>
            </div>
            <ul className="divide-y rounded-md border">
              {rows.map((r) => {
                const id = r.student._id;
                return (
                  <li key={id} className="p-3 space-y-2" data-testid={`row-attendance-${id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{nameOf(r.student)}</p>
                        {r.student.userId && <p className="text-xs text-muted-foreground">ID {r.student.userId}</p>}
                      </div>
                      <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${nameOf(r.student)}`}>
                        {(["present", "absent"] as const).map((s) => (
                          <Button key={s} type="button" size="sm" role="radio" aria-checked={marks[id] === s}
                            variant={marks[id] === s ? (s === "present" ? "default" : "destructive") : "outline"}
                            onClick={() => setMarks({ ...marks, [id]: s })} data-testid={`button-mark-${s}-${id}`}>
                            {s === "present" ? "Present" : "Absent"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {r.status === "absent" && (r.makeup ? (
                      <Badge variant="secondary" className="text-xs">Made up on {r.makeup.date}</Badge>
                    ) : makeupFor === id ? (
                      <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); saveMakeup.mutate(id); }}>
                        <Input type="date" className="w-auto" min={lecture.date} max={today} value={makeup.date} onChange={(e) => setMakeup({ ...makeup, date: e.target.value })} aria-label="Date attended" data-testid={`input-makeup-date-${id}`} />
                        <Input className="flex-1 min-w-[140px]" placeholder="Where or how (optional)" value={makeup.notes} onChange={(e) => setMakeup({ ...makeup, notes: e.target.value })} aria-label="Make-up notes" />
                        <Button type="submit" size="sm" disabled={saveMakeup.isPending} data-testid={`button-save-makeup-${id}`}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setMakeupFor(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="h-auto px-1 py-0.5 text-xs text-primary underline-offset-2 hover:underline" onClick={() => { setMakeupFor(id); setMakeup({ date: today, notes: "" }); }} data-testid={`button-makeup-${id}`}>
                        Record make-up attendance
                      </Button>
                    ))}
                    {!!r.changes.length && <p className="text-[11px] text-muted-foreground">Changed: {r.changes.map((c) => `${c.from}→${c.to}${c.byName ? ` by ${c.byName}` : ""}`).join(", ")}</p>}
                  </li>
                );
              })}
            </ul>
            <Button className="w-full" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="button-save-attendance">
              {save.isPending ? "Saving..." : "Save Attendance"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
