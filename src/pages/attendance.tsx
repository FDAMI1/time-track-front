import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, CheckCircle2, Clock, XCircle, Users, Bell, Check, X, UserCheck, FileDown, Copy } from "lucide-react";

const statusBadge: Record<string, { className: string; label: string }> = {
  present: { className: "bg-chart-2/10 text-chart-2", label: "Present" },
  late: { className: "bg-chart-4/10 text-chart-4", label: "Late" },
  absent: { className: "bg-destructive/10 text-destructive", label: "Absent" },
  pending: { className: "bg-chart-3/10 text-chart-3", label: "Pending" },
  half_day: { className: "bg-chart-5/10 text-chart-5", label: "Half Day" },
  not_marked: { className: "bg-muted text-muted-foreground", label: "Not Marked" },
};

function getRoleTabs(role: string, orgType?: string) {
  if (role === "org_admin") {
    if (orgType === "academy") {
      return [
        { value: "student", label: "Student Attendance", roleFilter: "student" },
        { value: "teacher", label: "Teacher Attendance", roleFilter: "teacher" },
      ];
    } else {
      return [
        { value: "employee", label: "Employee Attendance", roleFilter: "employee" },
        { value: "manager", label: "Manager Attendance", roleFilter: "manager" },
      ];
    }
  }
  if (role === "teacher") {
    return [
      { value: "my", label: "My Attendance", roleFilter: null },
      { value: "student", label: "Student Attendance", roleFilter: "student" },
    ];
  }
  if (role === "manager") {
    return [
      { value: "my", label: "My Attendance", roleFilter: null },
      { value: "employee", label: "Employee Attendance", roleFilter: "employee" },
    ];
  }
  return [
    { value: "my", label: "My Attendance", roleFilter: null },
  ];
}

export default function AttendancePage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const orgType = user?.organizationId?.type;
  const tabs = getRoleTabs(user?.role || "", orgType);
  const [activeTab, setActiveTab] = useState(tabs[0]?.value || "my");

  const { data: myRecords, isLoading: myLoading } = useQuery({
    queryKey: ["/api/attendance/my"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/attendance/stats"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const currentTab = tabs.find((t) => t.value === activeTab);
  const hasRoleFilter = currentTab?.roleFilter;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-attendance-title">Attendance</h1>
        <p className="text-muted-foreground">Track and manage attendance records</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-chart-2 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.present || 0}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-chart-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.late || 0}</p>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="w-6 h-6 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.absent || 0}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarCheck className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.percentage || 0}%</p>
            <p className="text-xs text-muted-foreground">Rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}-attendance`}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.roleFilter ? (
              <TeamAttendanceTab
                roleFilter={tab.roleFilter}
                token={token!}
                viewerRole={user?.role || ""}
                orgType={orgType}
              />
            ) : (
              <MyAttendanceTab records={myRecords} isLoading={myLoading} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function MyAttendanceTab({ records, isLoading }: { records: any[]; isLoading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-48 w-full" /></div>
        ) : (records || []).length === 0 ? (
          <div className="py-12 text-center">
            <CalendarCheck className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No attendance records yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(records || []).slice(0, 30).flatMap((r: any) => {
                const sb = statusBadge[r.status] || statusBadge.pending;
                const sessions = (r.sessions || []).filter((s: any) => s.checkIn);
                const fmtTime = (d?: any) => {
                  if (!d) return "-";
                  const dt = new Date(d);
                  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                };
                if (sessions.length > 0) {
                  return sessions.map((s: any, si: number) => (
                    <TableRow key={`${r._id}-${si}`}>
                      <TableCell className="font-medium">
                        {si === 0 ? new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {si === 0 ? r.policyId?.name || "—" : ""}
                      </TableCell>
                      <TableCell>
                        {si === 0 && <span className={`text-xs px-2 py-1 rounded-md ${sb.className}`}>{sb.label}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtTime(s.checkIn)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtTime(s.checkOut)}</TableCell>
                    </TableRow>
                  ));
                }
                return [(
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">
                      {new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.policyId?.name || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-md ${sb.className}`}>{sb.label}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.checkInTime || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.checkOutTime || "-"}</TableCell>
                  </TableRow>
                )];
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function openWhatsappLinks(notification: any) {
  if (!notification) return;
  const { studentWhatsapp, parentWhatsapp, message } = notification;
  const encoded = encodeURIComponent(message || "");
  if (studentWhatsapp) {
    const num = studentWhatsapp.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${num}?text=${encoded}`, "_blank");
  }
  if (parentWhatsapp) {
    const num = parentWhatsapp.replace(/[^0-9]/g, "");
    setTimeout(() => {
      window.open(`https://wa.me/${num}?text=${encoded}`, "_blank");
    }, 500);
  }
}

function openBulkWhatsappLinks(notifications: any[]) {
  if (!notifications || notifications.length === 0) return;
  let delay = 0;
  for (const notif of notifications) {
    const { studentWhatsapp, parentWhatsapp, message } = notif;
    const encoded = encodeURIComponent(message || "");
    if (studentWhatsapp) {
      const num = studentWhatsapp.replace(/[^0-9]/g, "");
      setTimeout(() => { window.open(`https://wa.me/${num}?text=${encoded}`, "_blank"); }, delay);
      delay += 400;
    }
    if (parentWhatsapp) {
      const num = parentWhatsapp.replace(/[^0-9]/g, "");
      setTimeout(() => { window.open(`https://wa.me/${num}?text=${encoded}`, "_blank"); }, delay);
      delay += 400;
    }
  }
}

function TeamAttendanceTab({ roleFilter, token, viewerRole = "", orgType }: { roleFilter: string; token: string; viewerRole?: string; orgType?: string }) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");

  const { data: policies } = useQuery({
    queryKey: ["/api/policy"],
    queryFn: async () => {
      const res = await fetch("/api/policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const effectivePolicyId = selectedPolicyId || (policies && policies.length > 0 ? policies[0]._id : "");
  const policyIdParam = effectivePolicyId;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/attendance/daily-list", roleFilter, effectivePolicyId],
    queryFn: async () => {
      let url = `/api/attendance/daily-list?roleFilter=${roleFilter}`;
      if (policyIdParam) url += `&policyId=${policyIdParam}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markForUser = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const body: any = { userId, status };
      if (policyIdParam) body.policyId = policyIdParam;
      const res = await fetch("/api/attendance/mark-for-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/daily-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/org"] });
      toast({ title: "Attendance updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markBulk = useMutation({
    mutationFn: async (userIds: string[]) => {
      const body: any = { userIds, status: "present" };
      if (policyIdParam) body.policyId = policyIdParam;
      const res = await fetch("/api/attendance/mark-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to mark");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/daily-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/org"] });
      toast({ title: `Marked ${result.marked} member(s) present` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark attendance", variant: "destructive" });
    },
  });

  const markBulkAbsent = useMutation({
    mutationFn: async (userIds: string[]) => {
      const body: any = { userIds, status: "absent" };
      if (policyIdParam) body.policyId = policyIdParam;
      const res = await fetch("/api/attendance/mark-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to mark");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/daily-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/org"] });
      toast({ title: `Marked ${result.marked} member(s) absent` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark attendance", variant: "destructive" });
    },
  });

  const approveAttendance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/attendance/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/daily-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/org"] });
      toast({ title: "Attendance updated" });
    },
  });

  const members = data?.members || [];
  const sortOrder: Record<string, number> = { pending: 0, not_marked: 1 };
  const sortedMembers = [...members].sort((a: any, b: any) => (sortOrder[a.status] ?? 2) - (sortOrder[b.status] ?? 2));
  const unmarkedMembers = members.filter((m: any) => m.status === "not_marked");
  const pendingMembers = members.filter((m: any) => m.status === "pending");

  async function downloadStudentReport(userId: string, name: string) {
    try {
      const res = await fetch(`/api/reports/user/${userId}?period=monthly&format=xlsx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\s+/g, "-")}-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Report download failed", variant: "destructive" });
    }
  }
  const pendingCount = pendingMembers.length;
  const roleLabel = roleFilter === "student" ? "Students" : roleFilter === "teacher" ? "Teachers" : roleFilter === "manager" ? "Managers" : "Employees";
  const hasMultiplePolicies = policies && policies.length > 1;
  const selectedPolicyName = effectivePolicyId
    ? policies?.find((p: any) => p._id === effectivePolicyId)?.name
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              {roleLabel} — {selectedPolicyName ? `${selectedPolicyName}` : "Daily Attendance"} ({today})
              {pendingCount > 0 && (
                <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 ml-2" data-testid="badge-pending-count">
                  <Bell className="w-3 h-3 mr-1" />
                  {pendingCount} pending
                </Badge>
              )}
            </CardTitle>
            {hasMultiplePolicies && (
              <Select value={effectivePolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger className="w-[180px]" data-testid="select-session-filter">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p: any) => (
                    <SelectItem key={p._id} value={p._id} data-testid={`option-session-${p._id}`}>
                      {p.name} ({p.startTime}–{p.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {policies && policies.length === 1 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {policies[0].name} ({policies[0].startTime}–{policies[0].endTime})
              </span>
            )}
          </div>
          {unmarkedMembers.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => markBulk.mutate(unmarkedMembers.map((m: any) => m._id))}
                disabled={markBulk.isPending}
                data-testid="button-mark-all-present"
              >
                <UserCheck className="w-4 h-4 mr-1" />
                {markBulk.isPending ? "Marking..." : `Mark All Present (${unmarkedMembers.length})`}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => markBulkAbsent.mutate(unmarkedMembers.map((m: any) => m._id))}
                disabled={markBulkAbsent.isPending}
                data-testid="button-mark-all-absent"
              >
                <XCircle className="w-4 h-4 mr-1" />
                {markBulkAbsent.isPending ? "Marking..." : "Mark All Absent"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-48 w-full" /></div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No {roleLabel.toLowerCase()} found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                {viewerRole === "manager" && roleFilter === "employee" ? (
                  <>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours</TableHead>
                  </>
                ) : (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((m: any) => {
                const sb = statusBadge[m.status] || statusBadge.not_marked;
                const isPending = m.status === "pending";
                const isNotMarked = m.status === "not_marked";
                return (
                  <TableRow key={m._id} data-testid={`row-member-attendance-${m._id}`} className={isPending ? "bg-chart-3/5" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {m.firstName} {m.lastName}
                        {isPending && (
                          <span className="relative flex h-2.5 w-2.5" data-testid={`notification-pending-${m._id}`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-3 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-chart-3"></span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-md ${sb.className}`}>{sb.label}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.checkInTime || "-"}</TableCell>
                    {viewerRole === "manager" && roleFilter === "employee" ? (
                      <>
                        <TableCell className="text-muted-foreground">{m.checkOutTime || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {m.checkInTime && m.checkOutTime ? (() => {
                            const [ih, im] = m.checkInTime.split(":").map(Number);
                            const [oh, om] = m.checkOutTime.split(":").map(Number);
                            const mins = (oh * 60 + om) - (ih * 60 + im);
                            if (mins <= 0) return "-";
                            return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                          })() : "-"}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="text-right">
                        {(roleFilter === "student" || roleFilter === "employee") && !isPending && !isNotMarked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => downloadStudentReport(m._id, `${m.firstName} ${m.lastName}`)}
                            data-testid={`button-report-${m._id}`}
                            title="Download monthly report"
                          >
                            <FileDown className="w-3.5 h-3.5 mr-1" />
                            Report
                          </Button>
                        )}
                        {isPending && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveAttendance.mutate({ id: m.attendanceId, status: "present" })}
                              disabled={approveAttendance.isPending}
                              data-testid={`button-confirm-${m._id}`}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => approveAttendance.mutate({ id: m.attendanceId, status: "absent" })}
                              disabled={approveAttendance.isPending}
                              data-testid={`button-decline-${m._id}`}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Decline
                            </Button>
                          </div>
                        )}
                        {!isPending && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant={m.status === "present" || m.status === "late" ? "default" : "outline"}
                              className={m.status === "present" || m.status === "late" ? "bg-chart-2 hover:bg-chart-2/90 text-white" : "border-chart-2/50 text-chart-2 hover:bg-chart-2/10"}
                              onClick={() => markForUser.mutate({ userId: m._id, status: "present" })}
                              disabled={markForUser.isPending || m.status === "present"}
                              data-testid={`button-mark-present-${m._id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={m.status === "absent" ? "default" : "outline"}
                              className={m.status === "absent" ? "bg-destructive hover:bg-destructive/90 text-white" : "border-destructive/50 text-destructive hover:bg-destructive/10"}
                              onClick={() => markForUser.mutate({ userId: m._id, status: "absent" })}
                              disabled={markForUser.isPending || m.status === "absent"}
                              data-testid={`button-mark-absent-${m._id}`}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Absent
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {roleFilter === "student" && orgType === "academy" && (() => {
          const absentList = members.filter((m: any) => m.status === "absent");
          if (absentList.length === 0) return null;
          function copyText(text: string, label: string) {
            navigator.clipboard.writeText(text).then(() => {
              toast({ title: `${label} copied to clipboard` });
            });
          }
          return (
            <div className="border-t p-4 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                Absent Students ({absentList.length})
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const phones = absentList.flatMap((m: any) => [m.phone, m.parentPhone].filter(Boolean)).join(", ");
                    copyText(phones || "No phone numbers available", "Phone numbers");
                  }}
                  data-testid="button-copy-absent-phones"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Phone Numbers
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const names = absentList.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ");
                    copyText(`Absent today (${today}): ${names}`, "Absent list");
                  }}
                  data-testid="button-copy-absent-names"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Absent Names
                </Button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {absentList.map((m: any) => (
                  <div key={m._id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-destructive/5">
                    <span className="font-medium">{m.firstName} {m.lastName}</span>
                    {(m.phone || m.parentPhone) && (
                      <button
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onClick={() => copyText(m.phone || m.parentPhone, `${m.firstName}'s number`)}
                        data-testid={`button-copy-phone-${m._id}`}
                      >
                        <Copy className="w-3 h-3" />
                        {m.phone || m.parentPhone}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
