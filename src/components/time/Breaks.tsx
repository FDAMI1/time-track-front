import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { formatTime12 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Square } from "lucide-react";

export interface TimeBreakRow {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  startedAt: string;
  duration: number;
  status: "running" | "completed";
}

type Coords = () => Promise<{ latitude: number; longitude: number } | null>;

const formatDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
export const formatClock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, "0")).join(":");

// The running break and the completed ones for the period. Both live on the server,
// so a reload, another tab or a fresh login shows the same break.
export function useBreaks({ fromDate, toDate, userId, coords }: { fromDate: string; toDate: string; userId: string; coords: Coords }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const viewingSelf = !userId;

  const { data: running } = useQuery({
    queryKey: ["/api/timetracking/break"],
    queryFn: () => api.get<TimeBreakRow | null>("/api/timetracking/break"),
    enabled: viewingSelf,
  });
  const { data: breaks } = useQuery({
    queryKey: ["/api/timetracking/breaks", fromDate, toDate, userId],
    queryFn: () => api.get<TimeBreakRow[]>(`/api/timetracking/breaks?startDate=${fromDate}&endDate=${toDate}${userId ? `&userId=${userId}` : ""}`),
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

  const toggle = useMutation({
    mutationFn: async (action: "start" | "stop") => api.post(`/api/timetracking/break/${action}`, action === "start" ? { ...((await coords()) || {}) } : {}),
    onSuccess: (_d, action) => toast({ title: action === "start" ? "Work saved. Break started." : "Break saved. Start a task when you're back." }),
    onError: (err: Error) => toast({ title: "Break", description: err.message, variant: "destructive" }),
    // Refresh either way: after a failure the server's state is the truth.
    onSettled: () => ["/api/timetracking/timer", "/api/timetracking/break", "/api/timetracking/breaks", "/api/timetracking", "/api/timetracking/report"]
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  });

  const runningInRange = viewingSelf && !!running && running.date >= fromDate && running.date <= toDate;
  const totalMinutes = (breaks || []).reduce((sum, b) => sum + b.duration, 0) + (runningInRange ? Math.floor(elapsed / 60) : 0);

  return { running: running || null, breaks: breaks || [], elapsed, totalMinutes, toggle };
}

export function BreakButton({ timerRunning, onBreak, elapsed, busy, onStart, onStop }: {
  timerRunning: boolean; onBreak: boolean; elapsed: number; busy: boolean; onStart: () => void; onStop: () => void;
}) {
  if (onBreak) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 h-10 bg-red-500/10 rounded-md" data-testid="text-break-elapsed">
          <Coffee className="w-4 h-4 text-red-600" />
          <span className="font-mono text-sm font-medium text-red-700 dark:text-red-400">{formatClock(elapsed)}</span>
        </div>
        <Button variant="destructive" className="gap-2" onClick={onStop} disabled={busy} data-testid="button-stop-break">
          <Square className="w-4 h-4" />Stop Break
        </Button>
      </>
    );
  }
  return (
    <Button
      variant="outline"
      className="gap-2 border-amber-500/60 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400"
      onClick={onStart}
      disabled={!timerRunning || busy}
      title={timerRunning ? "Save the current task and start a break" : "Start a task first, then take a break"}
      data-testid="button-start-break"
    >
      <Coffee className="w-4 h-4" />Break
    </Button>
  );
}

// A completed break in the day's list: red, labelled BREAK, with no approval or edit controls.
export function BreakRow({ brk }: { brk: TimeBreakRow }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-red-500/5 border border-red-500/20" data-testid={`break-${brk._id}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-1 h-10 rounded-full bg-red-500 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <Coffee className="w-4 h-4 text-red-600 shrink-0" />
          <Badge className="bg-red-600 hover:bg-red-600 text-white tracking-wide">BREAK</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 pl-4 sm:pl-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime12(brk.startTime)} - {formatTime12(brk.endTime)}</span>
        <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-400">{formatDuration(brk.duration)}</Badge>
      </div>
    </div>
  );
}
