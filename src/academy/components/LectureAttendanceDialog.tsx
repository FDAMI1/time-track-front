import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { formatTime12 } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RemoteImage } from "@/components/remote-image";
import { localToday, nameOf, type Lecture, type Person } from "@/academy/lib/academy";

type Mark = "present" | "absent" | "rejected";
type Status = Mark | "pending" | null;

interface Row {
  student: Person & { userId?: string; photoUrl?: string };
  batchName: string;
  checkIn: { status: string; checkInTime: string } | null;
  status: Status;
  method: "" | "checkin" | "manual";
  markedBy?: Person | null;
  markedAt?: string | null;
  changes: { from: string; to: string; byName?: string; at: string }[];
  makeup: { date: string; notes: string; startTime?: string; durationMinutes?: number; topicTaught?: string } | null;
}

const LABEL: Record<string, { text: string; tone: string }> = {
  pending: { text: "Pending Approval", tone: "border-amber-500/50 text-amber-700 dark:text-amber-400" },
  present: { text: "Present", tone: "border-green-600/50 text-green-700 dark:text-green-400" },
  absent: { text: "Absent", tone: "border-destructive/50 text-destructive" },
  rejected: { text: "Rejected", tone: "border-destructive/50 text-destructive" },
};
const EMPTY_MAKEUP = { date: localToday(), startTime: "", durationMinutes: "", topicTaught: "", notes: "" };

// The lecturer decides each student's attendance. A student who checked in that day waits for
// Approve (present) or Deny (rejected); the others are marked Present or Absent. Present completes
// the topic for that student; Absent and Rejected leave it as a recovery topic until a make-up.
export default function LectureAttendanceDialog({ lecture, onClose }: { lecture: Lecture; onClose: () => void }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const key = ["/api/lectures", lecture._id, "attendance"];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<{ students: Row[]; today: string; lecture: Lecture }>(`/api/lectures/${lecture._id}/attendance`) });
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [makeupFor, setMakeupFor] = useState<string | null>(null);
  const [makeup, setMakeup] = useState(EMPTY_MAKEUP);

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.filter((r) => r.status && r.status !== "pending").map((r) => [r.student._id, r.status as Mark])));
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
  };
  const save = useMutation({
    mutationFn: () => api.post(`/api/lectures/${lecture._id}/attendance`, { records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }),
    onSuccess: () => { refresh(); toast({ title: "Attendance saved", description: "Present students completed the topic; absent and denied students have it as a recovery topic." }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });
  const saveMakeup = useMutation({
    mutationFn: (studentId: string) => api.post(`/api/lectures/${lecture._id}/makeup`, { studentId, ...makeup, durationMinutes: makeup.durationMinutes ? Number(makeup.durationMinutes) : 0 }),
    onSuccess: () => { refresh(); setMakeupFor(null); toast({ title: "Recovery recorded", description: "The topic is completed for this student; the original absence stays." }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  // "Today" is the organization's date (its time zone), which is what the server checks.
  const today = data?.today || localToday();
  const current = data?.lecture || lecture;
  const rows = data?.students || [];
  const future = current.date > today;
  const running = current.status === "in_progress";
  const count = (m: Mark) => Object.values(marks).filter((x) => x === m).length;
  const undecided = rows.filter((r) => !marks[r.student._id]).length;
  const saved = Object.fromEntries(rows.map((r) => [r.student._id, r.status]));
  const dirty = rows.some((r) => marks[r.student._id] && marks[r.student._id] !== saved[r.student._id]);
  const choice = (id: string, value: Mark, label: string, variant: "default" | "destructive") => (
    <Button key={value} type="button" size="sm" role="radio" aria-checked={marks[id] === value} variant={marks[id] === value ? variant : "outline"}
      onClick={() => setMarks({ ...marks, [id]: value })} data-testid={`button-mark-${value}-${id}`}>{label}</Button>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance · {current.title}</DialogTitle>
          <DialogDescription>
            {current.batchId?.batchName} · {current.date} {formatTime12(current.actualStartTime || current.startTime)}–{formatTime12(current.actualEndTime || current.endTime)}
            {current.durationMinutes ? ` · ${current.durationMinutes} min` : ""}
            {current.subject ? ` · ${current.subject}` : ""}{current.portion ? ` · ${current.portion}` : ""}
          </DialogDescription>
        </DialogHeader>
        {running && <p className="text-sm text-violet-700 dark:text-violet-400" data-testid="text-attendance-running">This lecture is still running. Stop it in Time Tracking, then mark attendance.</p>}
        {future && <p className="text-sm text-muted-foreground" data-testid="text-attendance-future">Attendance opens on the lecture date. Today is {today} in your organization's time zone.</p>}
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && !rows.length && <p className="text-sm text-muted-foreground">This lecture has no students.</p>}
        {!!rows.length && !future && !running && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground" data-testid="text-attendance-count">
                {rows.length} students · {count("present")} present · {count("absent")} absent{count("rejected") ? ` · ${count("rejected")} denied` : ""}{undecided ? ` · ${undecided} not decided` : ""}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.student._id, "present"])))} data-testid="button-all-present">All present</Button>
            </div>
            <ul className="divide-y rounded-md border">
              {rows.map((r) => {
                const id = r.student._id;
                const shown = LABEL[marks[id] || r.status || ""];
                return (
                  <li key={id} className="p-3 space-y-2" data-testid={`row-attendance-${id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 text-xs font-semibold">
                          <RemoteImage src={r.student.photoUrl || ""} alt={nameOf(r.student)} className="w-full h-full object-cover" fallback={<span>{(r.student.firstName?.[0] || "") + (r.student.lastName?.[0] || "")}</span>} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{nameOf(r.student)}</p>
                          <p className="text-xs text-muted-foreground">{r.student.userId ? `ID ${r.student.userId} · ` : ""}{r.batchName}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-checkin-${id}`}>
                            {r.checkIn ? `Checked in${r.checkIn.checkInTime ? ` at ${formatTime12(r.checkIn.checkInTime)}` : ""}` : "No check-in"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {shown && <Badge variant="outline" className={shown.tone} data-testid={`badge-status-${id}`}>{shown.text}</Badge>}
                        <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${nameOf(r.student)}`}>
                          {r.checkIn
                            ? [choice(id, "present", "Approve", "default"), choice(id, "rejected", "Deny", "destructive")]
                            : [choice(id, "present", "Present", "default"), choice(id, "absent", "Absent", "destructive")]}
                        </div>
                      </div>
                    </div>
                    {r.method && r.markedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        {r.method === "checkin" ? "Decided on check-in" : "Marked by hand"}{r.markedBy ? ` by ${nameOf(r.markedBy)}` : ""} · {new Date(r.markedAt).toLocaleString()}
                      </p>
                    )}
                    {(r.status === "absent" || r.status === "rejected") && (r.makeup ? (
                      <Badge variant="secondary" className="text-xs">Recovered on {r.makeup.date}{r.makeup.topicTaught ? ` · ${r.makeup.topicTaught}` : ""}</Badge>
                    ) : makeupFor === id ? (
                      <form className="grid grid-cols-2 sm:grid-cols-4 gap-2" onSubmit={(e) => { e.preventDefault(); saveMakeup.mutate(id); }}>
                        <Input type="date" min={current.date} max={today} value={makeup.date} onChange={(e) => setMakeup({ ...makeup, date: e.target.value })} aria-label="Recovery date" data-testid={`input-makeup-date-${id}`} />
                        <Input type="time" value={makeup.startTime} onChange={(e) => setMakeup({ ...makeup, startTime: e.target.value })} aria-label="Recovery start time" />
                        <Input type="number" min={0} max={600} placeholder="Minutes" value={makeup.durationMinutes} onChange={(e) => setMakeup({ ...makeup, durationMinutes: e.target.value })} aria-label="Recovery duration in minutes" />
                        <Input placeholder="Topic taught" value={makeup.topicTaught} onChange={(e) => setMakeup({ ...makeup, topicTaught: e.target.value })} aria-label="Topic taught" />
                        <Input className="col-span-2 sm:col-span-4" placeholder="Notes (optional)" value={makeup.notes} onChange={(e) => setMakeup({ ...makeup, notes: e.target.value })} aria-label="Recovery notes" />
                        <div className="col-span-2 sm:col-span-4 flex gap-2">
                          <Button type="submit" size="sm" disabled={saveMakeup.isPending} data-testid={`button-save-makeup-${id}`}>Complete recovery</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setMakeupFor(null)}>Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="h-auto px-1 py-0.5 text-xs text-primary underline-offset-2 hover:underline" onClick={() => { setMakeupFor(id); setMakeup({ ...EMPTY_MAKEUP, date: today }); }} data-testid={`button-makeup-${id}`}>
                        Record recovery lecture
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
