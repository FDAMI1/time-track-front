import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { formatTime12 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Square } from "lucide-react";
import { formatClock } from "./Breaks";

export interface TimeLectureRow {
  _id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  startedAt: string;
  duration: number;
  status: "running" | "completed";
}

interface ScheduledLecture { _id: string; title: string; startTime: string; endTime: string; batchId?: { batchName?: string } | null }
interface LectureOptions { canCreate: boolean; scheduled: ScheduledLecture[]; batches: { _id: string; batchName: string }[] }

type Coords = () => Promise<{ latitude: number; longitude: number } | null>;
type StartBody = { title: string; lectureId?: string; batchId?: string; subject?: string; portion?: string; description?: string };

const EMPTY_FORM = { lectureId: "none", batchId: "none", title: "", subject: "", portion: "", description: "" };
const formatDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const REFRESH = ["/api/timetracking/timer", "/api/timetracking/break", "/api/timetracking/lecture", "/api/timetracking/lectures", "/api/timetracking/lecture/options", "/api/timetracking", "/api/timetracking/report", "/api/lectures"];

// The running lecture and the completed ones for the period, both from the server, so a reload,
// another tab or a fresh login shows the same lecture. Lecture time is never work and never waits for approval.
export function useLectures({ fromDate, toDate, userId, coords }: { fromDate: string; toDate: string; userId: string; coords: Coords }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const viewingSelf = !userId;

  const { data: running } = useQuery({
    queryKey: ["/api/timetracking/lecture"],
    queryFn: () => api.get<TimeLectureRow | null>("/api/timetracking/lecture"),
    enabled: viewingSelf,
  });
  const { data: lectures } = useQuery({
    queryKey: ["/api/timetracking/lectures", fromDate, toDate, userId],
    queryFn: () => api.get<TimeLectureRow[]>(`/api/timetracking/lectures?startDate=${fromDate}&endDate=${toDate}${userId ? `&userId=${userId}` : ""}`),
  });

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running?.startedAt) { setElapsed(0); return; }
    const started = new Date(running.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running?.startedAt]);

  const start = useMutation({
    mutationFn: async (body: StartBody) => api.post("/api/timetracking/lecture/start", { ...body, ...((await coords()) || {}) }),
    onSuccess: () => toast({ title: "Lecture started" }),
    onError: (err: Error) => toast({ title: "Lecture", description: err.message, variant: "destructive" }),
    onSettled: () => REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  });
  const stop = useMutation({
    mutationFn: () => api.post("/api/timetracking/lecture/stop", {}),
    onSuccess: () => toast({ title: "Lecture saved. Start a task when you're back." }),
    onError: (err: Error) => toast({ title: "Lecture", description: err.message, variant: "destructive" }),
    onSettled: () => REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  });

  const runningInRange = viewingSelf && !!running && running.date >= fromDate && running.date <= toDate;
  const totalMinutes = (lectures || []).reduce((sum, l) => sum + l.duration, 0) + (runningInRange ? Math.floor(elapsed / 60) : 0);

  return { running: running || null, lectures: lectures || [], elapsed, totalMinutes, start, stop };
}

// Start a lecture (topic, or one of today's scheduled lectures), or show the running one with Stop.
export function LectureButton({ inLecture, blocked, elapsed, busy, onStart, onStop }: {
  inLecture: boolean; blocked: boolean; elapsed: number; busy: boolean; onStart: (body: StartBody) => void; onStop: () => void;
}) {
  const api = useMcqApi();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const { data: options } = useQuery({
    queryKey: ["/api/timetracking/lecture/options"],
    queryFn: () => api.get<LectureOptions>("/api/timetracking/lecture/options"),
    enabled: open,
  });
  const scheduled = options?.scheduled || [];
  const batches = options?.batches || [];

  if (inLecture) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 h-10 bg-violet-500/10 rounded-md" data-testid="text-lecture-elapsed">
          <GraduationCap className="w-4 h-4 text-violet-600" />
          <span className="font-mono text-sm font-medium text-violet-700 dark:text-violet-400">{formatClock(elapsed)}</span>
        </div>
        <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white" onClick={onStop} disabled={busy} data-testid="button-stop-lecture">
          <Square className="w-4 h-4" />Stop Lecture
        </Button>
      </>
    );
  }

  const linked = scheduled.find((l) => l._id === form.lectureId);
  const batch = !linked && batches.find((b) => b._id === form.batchId);
  const submit = () => {
    const title = form.title.trim();
    if (linked) onStart({ title, lectureId: linked._id });
    else if (batch) onStart({ title, batchId: batch._id, subject: form.subject.trim(), portion: form.portion.trim(), description: form.description.trim() });
    else onStart({ title });
    setOpen(false);
    setForm(EMPTY_FORM);
  };
  const text = (key: "title" | "subject" | "portion" | "description", label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`lecture-${key}`}>{label}</Label>
      <Input id={`lecture-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} maxLength={key === "description" ? 2000 : 200} data-testid={`input-lecture-${key}`} />
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 border-violet-500/60 text-violet-700 hover:bg-violet-500/10 hover:text-violet-800 dark:text-violet-400"
        onClick={() => setOpen(true)}
        disabled={blocked || busy}
        title={blocked ? "Stop the running task or break first" : "Track time spent teaching a lecture"}
        data-testid="button-start-lecture"
      >
        <GraduationCap className="w-4 h-4" />Lecture
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Lecture</DialogTitle>
            <DialogDescription>Lecture time is tracked on its own. It isn't work time and doesn't need approval.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {scheduled.length > 0 && (
              <div className="space-y-1.5">
                <Label>Today's scheduled lecture</Label>
                <Select value={form.lectureId} onValueChange={(v) => set("lectureId", v)}>
                  <SelectTrigger data-testid="select-scheduled-lecture"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">A new lecture</SelectItem>
                    {scheduled.map((l) => (
                      <SelectItem key={l._id} value={l._id}>
                        {formatTime12(l.startTime)} · {l.title}{l.batchId?.batchName ? ` · ${l.batchId.batchName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!linked && options?.canCreate && (
              <div className="space-y-1.5">
                <Label>Batch</Label>
                <Select value={form.batchId} onValueChange={(v) => set("batchId", v)}>
                  <SelectTrigger data-testid="select-lecture-batch"><SelectValue placeholder="Choose a batch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No batch (time only)</SelectItem>
                    {batches.map((b) => <SelectItem key={b._id} value={b._id}>{b.batchName}</SelectItem>)}
                  </SelectContent>
                </Select>
                {batch && <p className="text-xs text-muted-foreground">The lecture is added to Lectures for this batch. Mark attendance there after you stop it.</p>}
              </div>
            )}
            {text("title", "Lecture title", linked ? linked.title : "What are you teaching?")}
            {batch && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {text("subject", "Subject or topic", "e.g. Algebra")}
                  {text("portion", "Section or chapter", "e.g. Chapter 4")}
                </div>
                {text("description", "Description", "Optional")}
              </>
            )}
            <Button type="submit" className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white" disabled={!form.title.trim() && !linked} data-testid="button-confirm-lecture">
              <GraduationCap className="w-4 h-4" />Start Lecture
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// A completed lecture in the day's list: violet, labelled LECTURE, with no approval or edit controls.
export function LectureRow({ lecture }: { lecture: TimeLectureRow }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-violet-500/5 border border-violet-500/20" data-testid={`lecture-${lecture._id}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-1 h-10 rounded-full bg-violet-500 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-violet-600 shrink-0" />
            <Badge className="bg-violet-600 hover:bg-violet-600 text-white tracking-wide">LECTURE</Badge>
          </div>
          <p className="text-sm font-medium truncate mt-1">{lecture.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 pl-4 sm:pl-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime12(lecture.startTime)} - {formatTime12(lecture.endTime)}</span>
        <Badge variant="outline" className="border-violet-500/40 text-violet-700 dark:text-violet-400">{formatDuration(lecture.duration)}</Badge>
      </div>
    </div>
  );
}
