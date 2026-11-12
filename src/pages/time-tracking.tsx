import { apiFetch, safeJson } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatTime12, localDateString } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Timer, Trash2, BarChart3, Calendar, Play, Square, Edit, Check, X, Plus, Hourglass, ClipboardCheck, Coffee } from "lucide-react";
import { getCurrentCoordinates, isLocationRequired } from "@/lib/geolocation";
import ManualEntryDialog from "@/components/time/ManualEntryDialog";
import ApprovalsPanel from "@/components/time/ApprovalsPanel";
import { EntryHistory, StatusBadge, statusOf } from "@/components/time/EntryStatus";
import { BreakButton, BreakRow, formatClock, useBreaks, type TimeBreakRow } from "@/components/time/Breaks";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { EmptyState } from "@/components/ui/states";

const COLORS = ["hsl(217, 91%, 45%)", "hsl(142, 76%, 36%)", "hsl(271, 81%, 46%)", "hsl(37, 91%, 45%)", "hsl(0, 84%, 45%)", "hsl(180, 70%, 35%)", "hsl(330, 70%, 45%)", "hsl(50, 90%, 40%)"];

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


export default function TimeTrackingPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const today = localDateString();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [viewTab, setViewTab] = useState<"entries" | "report" | "approvals">("entries");
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [newTaskName, setNewTaskName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const isAdmin = ["org_admin", "manager"].includes(user?.role || "");
  const canApprove = user?.role === "org_admin" || user?.permissions?.timeApproval === true;
  const roleLabel: Record<string, string> = {
    teacher: "Teacher",
    employee: "Employee",
    manager: "Manager",
    org_admin: "Admin",
    student: "Student",
  };

  // The running timer lives on the server, so it survives a reload or a second tab.
  const { data: running } = useQuery({
    queryKey: ["/api/timetracking/timer"],
    queryFn: async () => {
      const res = await apiFetch("/api/timetracking/timer", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return safeJson(res);
    },
    enabled: !!token,
  });
  const isTimerRunning = !!running;

  useEffect(() => {
    if (!running?.startedAt) { setElapsedSeconds(0); return; }
    const started = new Date(running.startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running?.startedAt]);

  const { data: orgData } = useQuery({
    queryKey: ["/api/organizations/my"],
    queryFn: async () => {
      const res = await apiFetch("/api/organizations/my", { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    enabled: !!token,
  });

  const isViewingSelf = !selectedUserId || selectedUserId === "self";
  const apiPath = isViewingSelf
    ? `/api/timetracking/my?startDate=${fromDate}&endDate=${toDate}`
    : `/api/timetracking/user/${selectedUserId}?startDate=${fromDate}&endDate=${toDate}`;

  const { data: entries, isLoading } = useQuery({
    queryKey: ["/api/timetracking", fromDate, toDate, selectedUserId],
    queryFn: async () => {
      const res = await apiFetch(apiPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return safeJson(res);
    },
  });

  const reportPath = isViewingSelf
    ? `/api/timetracking/report?startDate=${fromDate}&endDate=${toDate}`
    : `/api/timetracking/report?userId=${selectedUserId}&startDate=${fromDate}&endDate=${toDate}`;

  const { data: report } = useQuery({
    queryKey: ["/api/timetracking/report", fromDate, toDate, selectedUserId],
    queryFn: async () => {
      const res = await apiFetch(reportPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return safeJson(res);
    },
  });

  const { data: orgMembers } = useQuery({
    queryKey: ["/api/users/org-members-list"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const res = await apiFetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiFetch(`/api/timetracking/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/report"] });
      toast({ title: "Time entry updated" });
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/timetracking/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/report"] });
      toast({ title: "Time entry deleted" });
    },
  });

  // Location, when the organization requires it. Throws a message the user can act on.
  async function locationIfRequired() {
    return isLocationRequired(user, orgData) ? getCurrentCoordinates() : null;
  }

  // The server records the start and stop times; the browser only shows the running clock.
  const timerMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      const location = await locationIfRequired();
      const body = action === "start"
        ? { taskName: newTaskName.trim(), description: newDescription.trim(), ...(location || {}) }
        : { ...(location || {}) };
      const res = await apiFetch(`/api/timetracking/timer/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Something went wrong");
      return data;
    },
    onSuccess: (_d, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/timer"] });
      if (action === "stop") {
        queryClient.invalidateQueries({ queryKey: ["/api/timetracking"] });
        queryClient.invalidateQueries({ queryKey: ["/api/timetracking/report"] });
        setNewTaskName("");
        setNewDescription("");
        toast({ title: "Time entry saved" });
      }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleStart() {
    if (!newTaskName.trim()) {
      toast({ title: "Error", description: "Please enter a task name before starting", variant: "destructive" });
      return;
    }
    timerMutation.mutate("start");
  }

  const handleStop = () => timerMutation.mutate("stop");
  const onBreak = useBreaks({ fromDate, toDate, userId: isViewingSelf ? "" : selectedUserId, coords: locationIfRequired });
  const isOnBreak = isViewingSelf && !!onBreak.running;

  function startEdit(entry: any) {
    setEditingId(entry._id);
    setEditTaskName(entry.taskName);
    setEditDescription(entry.description || "");
  }

  function saveEdit(entry: any) {
    updateMutation.mutate({
      id: entry._id,
      data: { taskName: editTaskName, description: editDescription, startTime: entry.startTime, endTime: entry.endTime },
    });
  }

  const groupedEntries: Record<string, any[]> = {};
  [...(entries || []), ...onBreak.breaks.map((b: TimeBreakRow) => ({ ...b, isBreak: true }))].forEach((e: any) => {
    if (!groupedEntries[e.date]) groupedEntries[e.date] = [];
    groupedEntries[e.date].push(e);
  });
  Object.values(groupedEntries).forEach((day) => day.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)));

  // Approved time only; the server reports pending minutes beside it.
  const totalMinutes = report?.totalMinutes ?? 0;
  const pendingMinutes = report?.pendingMinutes ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="page-title" data-testid="text-time-tracking-title">Time Tracking</h1>
          <p className="text-muted-foreground">Track your daily work hours and tasks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {isAdmin && (
            <Select value={selectedUserId || "self"} onValueChange={(v) => setSelectedUserId(v === "self" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-user-filter">
                <SelectValue placeholder="View member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">My Entries</SelectItem>
                {(orgMembers || [])
                  .filter((m: any) => m.role !== "org_admin")
                  .map((m: any) => (
                    <SelectItem key={m._id} value={m._id} data-testid={`select-member-${m._id}`}>
                      <span className="flex items-center gap-2">
                        <span>{m.firstName} {m.lastName}</span>
                        <span className="text-xs text-muted-foreground">({roleLabel[m.role] || m.role})</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:w-auto">
            <div className="flex items-center gap-1 min-w-0">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value > toDate) setToDate(e.target.value);
                }}
                className="w-full min-w-0 sm:w-[150px]"
                data-testid="input-from-date"
              />
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full min-w-0 sm:w-[150px]"
                data-testid="input-to-date"
              />
            </div>
          </div>
        </div>
      </div>

      {!isViewingSelf && selectedUserId && (() => {
        const viewedMember = (orgMembers || []).find((m: any) => m._id === selectedUserId);
        if (!viewedMember) return null;
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border" data-testid="banner-viewing-member">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Viewing entries for</span>
            <span className="text-sm font-semibold">{viewedMember.firstName} {viewedMember.lastName}</span>
            <Badge variant="secondary" className="text-xs" data-testid="badge-viewed-member-role">
              {roleLabel[viewedMember.role] || viewedMember.role}
            </Badge>
          </div>
        );
      })()}

      {isViewingSelf && (
        <Card className={isTimerRunning ? "border-primary shadow-md" : ""}>
          <CardContent className="p-5">
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Task Name</Label>
                  <Input
                    value={isTimerRunning ? running.taskName : newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="What are you working on?"
                    disabled={isTimerRunning}
                    data-testid="input-task-name"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                  <Input
                    value={isTimerRunning ? running.description || "" : newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description (optional)"
                    disabled={isTimerRunning}
                    data-testid="input-task-description"
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  {isTimerRunning && (
                    <div className="flex items-center gap-2 px-3 h-10 bg-primary/10 rounded-md">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-mono text-sm font-medium" data-testid="text-timer-elapsed">
                        {formatElapsed(elapsedSeconds)}
                      </span>
                    </div>
                  )}
                  {!isTimerRunning ? (
                    <Button
                      onClick={handleStart}
                      className="gap-2"
                      disabled={timerMutation.isPending || isOnBreak}
                      title={isOnBreak ? "Stop the break first" : undefined}
                      data-testid="button-start-timer"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      variant="destructive"
                      className="gap-2"
                      disabled={timerMutation.isPending}
                      data-testid="button-stop-timer"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </Button>
                  )}
                  <BreakButton
                    timerRunning={isTimerRunning}
                    onBreak={isOnBreak}
                    elapsed={onBreak.elapsed}
                    busy={onBreak.toggle.isPending || timerMutation.isPending}
                    onStart={() => onBreak.toggle.mutate("start")}
                    onStop={() => onBreak.toggle.mutate("stop")}
                  />
                  <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)} data-testid="button-add-manual">
                    <Plus className="w-4 h-4" />
                    Manual Entry
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} coords={locationIfRequired} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Approved Time</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-time">{formatDuration(totalMinutes)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Waiting for Approval</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-pending-time">{formatDuration(pendingMinutes)}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-total-entries">{(entries || []).length} entries</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Hourglass className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tasks</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-unique-tasks">{report?.taskReport?.length || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-chart-3/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Break Time</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-break-time">{formatDuration(onBreak.totalMinutes)}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-break-count">
                  {isOnBreak ? <span className="text-red-600">On break · {formatClock(onBreak.elapsed)}</span> : `${onBreak.breaks.length} breaks`}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Coffee className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={viewTab === "entries" ? "default" : "outline"} onClick={() => setViewTab("entries")} data-testid="button-tab-entries">
          <Calendar className="w-4 h-4 mr-2" />
          Entries
        </Button>
        <Button variant={viewTab === "report" ? "default" : "outline"} onClick={() => setViewTab("report")} data-testid="button-tab-report">
          <BarChart3 className="w-4 h-4 mr-2" />
          Report
        </Button>
        {canApprove && (
          <Button variant={viewTab === "approvals" ? "default" : "outline"} onClick={() => setViewTab("approvals")} data-testid="button-tab-approvals">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Approvals
          </Button>
        )}
      </div>

      {viewTab === "approvals" && canApprove && <ApprovalsPanel fromDate={fromDate} toDate={toDate} />}

      {viewTab === "entries" && (
        <div className="space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          )}
          {!isLoading && Object.keys(groupedEntries).length === 0 && (
            <Card>
              <CardContent>
                <EmptyState icon={Timer} title="No time entries for this period" description="Start the timer above, or add a manual entry for time already worked." />
              </CardContent>
            </Card>
          )}
          {Object.entries(groupedEntries)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateEntries]) => {
              const dayTotal = dateEntries.filter((e: any) => statusOf(e) === "approved").reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
              return (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </CardTitle>
                      <Badge variant="secondary" data-testid={`badge-day-total-${date}`}>{formatDuration(dayTotal)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dateEntries.map((entry: any) => entry.isBreak ? <BreakRow key={entry._id} brk={entry} /> : (
                      <div key={entry._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`entry-${entry._id}`}>
                        {editingId === entry._id ? (
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-1 h-10 rounded-full bg-chart-2 shrink-0" />
                            <div className="flex-1 flex gap-2 min-w-0">
                              <Input
                                value={editTaskName}
                                onChange={(e) => setEditTaskName(e.target.value)}
                                className="h-8 text-sm"
                                data-testid={`input-edit-task-${entry._id}`}
                              />
                              <Input
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Description"
                                className="h-8 text-sm"
                                data-testid={`input-edit-desc-${entry._id}`}
                              />
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(entry)} data-testid={`button-save-edit-${entry._id}`}>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${entry._id}`}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-1 h-10 rounded-full bg-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{entry.taskName}{entry.category ? <span className="text-muted-foreground font-normal"> · {entry.category}</span> : null}</p>
                                {entry.description && <p className="text-xs text-muted-foreground truncate">{entry.description}</p>}
                                <div className="mt-1 flex items-center gap-2 flex-wrap"><StatusBadge entry={entry} /><EntryHistory entry={entry} /></div>
                                {statusOf(entry) === "rejected" && entry.rejectionReason && <p className="text-xs text-destructive mt-1">Rejected: {entry.rejectionReason}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 pl-4 sm:pl-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime12(entry.startTime)} - {formatTime12(entry.endTime)}</span>
                              <Badge variant="outline">{formatDuration(entry.duration)}</Badge>
                              {isViewingSelf && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)} data-testid={`button-edit-entry-${entry._id}`}>
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  {!(entry.source === "manual" && statusOf(entry) === "approved" && !isAdmin) && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(entry._id)} aria-label="Delete entry" data-testid={`button-delete-entry-${entry._id}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {viewTab === "report" && report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Time by Task</CardTitle>
            </CardHeader>
            <CardContent>
              {report.taskReport?.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.taskReport.map((t: any) => ({ name: t.task, value: t.minutes }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {report.taskReport.map((_: any, i: number) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatDuration(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(report.taskReport || []).map((t: any, i: number) => (
                  <div key={t.task} className="space-y-1" data-testid={`task-report-${i}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{t.task}</span>
                      <span className="text-sm text-muted-foreground">{formatDuration(t.minutes)} ({t.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${t.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
                {(!report.taskReport || report.taskReport.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {report.dailyReport?.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Hours by Date ({fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.dailyReport.map((d: any) => ({
                      date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                      hours: Math.round((d.minutes / 60) * 10) / 10,
                    })).reverse()}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => `${value} hrs`} />
                      <Bar dataKey="hours" name="Hours" fill="hsl(217, 91%, 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
