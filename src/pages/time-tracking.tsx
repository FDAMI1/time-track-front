import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
import { Clock, Timer, Trash2, BarChart3, Calendar, Play, Square, Edit, Check, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function TimeTrackingPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [viewTab, setViewTab] = useState<"entries" | "report">("entries");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [newTaskName, setNewTaskName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const isAdmin = ["org_admin", "manager"].includes(user?.role || "");

  const roleLabel: Record<string, string> = {
    teacher: "Teacher",
    employee: "Employee",
    manager: "Manager",
    org_admin: "Admin",
    student: "Student",
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const { data: orgData } = useQuery({
    queryKey: ["/api/organizations/my"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/my", { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const reportPath = isViewingSelf
    ? `/api/timetracking/report?startDate=${fromDate}&endDate=${toDate}`
    : `/api/timetracking/report?userId=${selectedUserId}&startDate=${fromDate}&endDate=${toDate}`;

  const { data: report } = useQuery({
    queryKey: ["/api/timetracking/report", fromDate, toDate, selectedUserId],
    queryFn: async () => {
      const res = await fetch(reportPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: orgMembers } = useQuery({
    queryKey: ["/api/users/org-members-list"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/timetracking", {
        method: "POST",
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
      toast({ title: "Time entry saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/timetracking/${id}`, {
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
      const res = await fetch(`/api/timetracking/${id}`, {
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

  async function handleStart() {
    if (!newTaskName.trim()) {
      toast({ title: "Error", description: "Please enter a task name before starting", variant: "destructive" });
      return;
    }
    const locationRequired = orgData?.isLocationRestrictionEnabled && orgData?.location?.latitude != null;
    if (locationRequired) {
      if (!navigator.geolocation) {
        toast({ title: "Location unavailable", description: "Your browser does not support geolocation", variant: "destructive" });
        return;
      }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true })
        );
        setCapturedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        toast({ title: "Location required", description: "Please allow location access in your browser to start time tracking", variant: "destructive" });
        return;
      }
    } else {
      setCapturedCoords(null);
    }
    const now = getCurrentTime();
    setTimerStartTime(now);
    setIsTimerRunning(true);
    setElapsedSeconds(0);
    startTimeRef.current = new Date();

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const diff = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        setElapsedSeconds(diff);
      }
    }, 1000);
  }

  function handleStop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const endTime = getCurrentTime();
    const today = new Date().toISOString().split("T")[0];

    addMutation.mutate({
      taskName: newTaskName.trim(),
      description: newDescription.trim(),
      startTime: timerStartTime,
      endTime,
      date: today,
      ...(capturedCoords ? { latitude: capturedCoords.lat, longitude: capturedCoords.lng } : {}),
    });

    setIsTimerRunning(false);
    setTimerStartTime("");
    setElapsedSeconds(0);
    startTimeRef.current = null;
    setCapturedCoords(null);
    setNewTaskName("");
    setNewDescription("");
  }

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
  (entries || []).forEach((e: any) => {
    if (!groupedEntries[e.date]) groupedEntries[e.date] = [];
    groupedEntries[e.date].push(e);
  });

  const totalMinutes = (entries || []).reduce((sum: number, e: any) => sum + (e.duration || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-time-tracking-title">Time Tracking</h1>
          <p className="text-muted-foreground">Track your daily work hours and tasks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Select value={selectedUserId || "self"} onValueChange={(v) => setSelectedUserId(v === "self" ? "" : v)}>
              <SelectTrigger className="w-[220px]" data-testid="select-user-filter">
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value > toDate) setToDate(e.target.value);
                }}
                className="w-[150px]"
                data-testid="input-from-date"
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[150px]"
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
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Task Name</Label>
                  <Input
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="What are you working on?"
                    disabled={isTimerRunning}
                    data-testid="input-task-name"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description (optional)"
                    disabled={isTimerRunning}
                    data-testid="input-task-description"
                  />
                </div>
                <div className="flex items-end gap-2">
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
                      disabled={addMutation.isPending}
                      data-testid="button-stop-timer"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
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
                <p className="text-xs text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-entries">{(entries || []).length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                <Timer className="w-5 h-5 text-chart-2" />
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
      </div>

      <div className="flex gap-2">
        <Button variant={viewTab === "entries" ? "default" : "outline"} onClick={() => setViewTab("entries")} data-testid="button-tab-entries">
          <Calendar className="w-4 h-4 mr-2" />
          Entries
        </Button>
        <Button variant={viewTab === "report" ? "default" : "outline"} onClick={() => setViewTab("report")} data-testid="button-tab-report">
          <BarChart3 className="w-4 h-4 mr-2" />
          Report
        </Button>
      </div>

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
              <CardContent className="p-8 text-center">
                <Timer className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No time entries found for this period</p>
                <p className="text-sm text-muted-foreground mt-1">Enter a task name above and click Start to begin tracking</p>
              </CardContent>
            </Card>
          )}
          {Object.entries(groupedEntries)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateEntries]) => {
              const dayTotal = dateEntries.reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
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
                    {dateEntries.map((entry: any) => (
                      <div key={entry._id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`entry-${entry._id}`}>
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
                                <p className="text-sm font-medium truncate">{entry.taskName}</p>
                                {entry.description && <p className="text-xs text-muted-foreground truncate">{entry.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-muted-foreground">{entry.startTime} - {entry.endTime}</span>
                              <Badge variant="outline">{formatDuration(entry.duration)}</Badge>
                              {isViewingSelf && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)} data-testid={`button-edit-entry-${entry._id}`}>
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(entry._id)} data-testid={`button-delete-entry-${entry._id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
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
