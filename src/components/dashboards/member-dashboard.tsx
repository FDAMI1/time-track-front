import { apiFetch } from "@/lib/api";
import { downloadAuthorized } from "@/lib/download";
import { getCurrentCoordinates, isLocationRequired } from "@/lib/geolocation";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { featureOn } from "@/academy/lib/academy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, XCircle, CalendarDays, TrendingUp, LogIn, LogOut, Calendar, BarChart3, Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

const statusColors: Record<string, string> = {
  present: "bg-chart-2/10 text-chart-2",
  late: "bg-chart-4/10 text-chart-4",
  absent: "bg-destructive/10 text-destructive",
  pending: "bg-chart-3/10 text-chart-3",
  not_marked: "bg-muted text-muted-foreground",
  none: "bg-muted/50 text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  pending: "Pending",
  not_marked: "Not Marked",
  none: "-",
};

const periodLabels: Record<string, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
  yearly: "This Year",
};

export default function MemberDashboard() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState("daily");
  const [detailType, setDetailType] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/dashboard/personal", period],
    queryFn: async () => {
      const res = await apiFetch(`/api/dashboard/personal?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  const { data: orgSettings } = useQuery<any>({
    queryKey: ["/api/organizations/my"],
    queryFn: async () => {
      const res = await apiFetch("/api/organizations/my", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load organization");
      return res.json();
    },
  });

  const markAttendance = useMutation({
    mutationFn: async () => {
      // Send the position whenever the server will ask for it.
      const coords = isLocationRequired(user, orgSettings) ? await getCurrentCoordinates() : null;
      const res = await apiFetch("/api/attendance/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(coords ?? {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/personal"] });
      if (data.status === "pending") {
        toast({ title: "Attendance submitted", description: "Your attendance has been submitted for teacher confirmation." });
      } else {
        toast({ title: "Attendance marked successfully" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/attendance/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/personal"] });
      toast({ title: "Checked out successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.periodStats || { present: 0, late: 0, absent: 0, total: 0 };
  const totalAttended = stats.present + stats.late + stats.absent;
  const attendancePercent = totalAttended > 0
    ? Math.round((stats.present + stats.late) / totalAttended * 100)
    : 0;

  function handleDownload(url: string, format: string) {
    downloadAuthorized(url, token, `report.${format}`).catch((err: Error) =>
      toast({ title: "Report download failed", description: err.message, variant: "destructive" })
    );
  }

  function downloadMyReport(format: string) {
    handleDownload(`/api/reports/my?period=${period}&format=${format}`, format);
  }

  function downloadTeamReport(format: string) {
    handleDownload(`/api/reports/team?period=${period}&format=${format}`, format);
  }

  const isTeamLead = user?.role === "teacher" || user?.role === "manager" || user?.role === "org_admin";

  const isStudent = user?.role === "student";
  const canMarkPresent = isStudent && data?.todayStatus === "not_marked";
  const canMarkAttendance = !isStudent && !data?.hasActiveSession;
  const canCheckOut = !isStudent && !!data?.hasActiveSession;

  const pLabel = periodLabels[period] || "Today";

  const detailTitles: Record<string, string> = {
    attendance: "Attendance Details",
    present: "Present Days",
    late: "Late Days",
    absent: "Absent Days",
    leave: "Leave Balance Details",
  };

  function getDetailContent() {
    switch (detailType) {
      case "attendance":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Your attendance rate for {pLabel.toLowerCase()}.</p>
            <div className="text-center p-6 rounded-md bg-primary/5">
              <p className="text-4xl font-bold">{attendancePercent}%</p>
              <p className="text-sm text-muted-foreground mt-1">Attendance Rate</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-md bg-chart-2/10 text-center">
                <p className="text-xl font-bold text-chart-2">{stats.present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div className="p-3 rounded-md bg-chart-4/10 text-center">
                <p className="text-xl font-bold text-chart-4">{stats.late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
              <div className="p-3 rounded-md bg-destructive/10 text-center">
                <p className="text-xl font-bold text-destructive">{stats.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </div>
        );
      case "present":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">You were present on {stats.present} day(s) {pLabel.toLowerCase()}.</p>
            <div className="p-4 rounded-md bg-chart-2/10 text-center">
              <CheckCircle2 className="w-10 h-10 text-chart-2 mx-auto mb-2" />
              <p className="text-3xl font-bold text-chart-2">{stats.present}</p>
              <p className="text-sm text-muted-foreground mt-1">Days Present</p>
            </div>
          </div>
        );
      case "late":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">You arrived late on {stats.late} day(s) {pLabel.toLowerCase()}.</p>
            <div className="p-4 rounded-md bg-chart-4/10 text-center">
              <Clock className="w-10 h-10 text-chart-4 mx-auto mb-2" />
              <p className="text-3xl font-bold text-chart-4">{stats.late}</p>
              <p className="text-sm text-muted-foreground mt-1">Days Late</p>
            </div>
          </div>
        );
      case "absent":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">You were absent on {stats.absent} day(s) {pLabel.toLowerCase()}.</p>
            <div className="p-4 rounded-md bg-destructive/10 text-center">
              <XCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-3xl font-bold text-destructive">{stats.absent}</p>
              <p className="text-sm text-muted-foreground mt-1">Days Absent</p>
            </div>
          </div>
        );
      case "leave":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Your leave balance for the current year.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-md bg-primary/5 text-center">
                <p className="text-2xl font-bold">{data?.leaveBalance?.total || 24}</p>
                <p className="text-xs text-muted-foreground">Total Allowed</p>
              </div>
              <div className="p-4 rounded-md bg-chart-2/10 text-center">
                <p className="text-2xl font-bold text-chart-2">{data?.leaveBalance?.remaining || 0}</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50 text-center">
                <p className="text-2xl font-bold">{data?.leaveBalance?.used || 0}</p>
                <p className="text-xs text-muted-foreground">Used</p>
              </div>
              <div className="p-4 rounded-md bg-chart-4/10 text-center">
                <p className="text-2xl font-bold text-chart-4">{data?.leaveBalance?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-member-dashboard-title">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[130px]" data-testid="select-period-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {featureOn(user, "attendance") && <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${statusColors[data?.todayStatus || "not_marked"]}`}>
                {data?.todayStatus === "present" && <CheckCircle2 className="w-7 h-7" />}
                {data?.todayStatus === "late" && <Clock className="w-7 h-7" />}
                {data?.todayStatus === "absent" && <XCircle className="w-7 h-7" />}
                {data?.todayStatus === "pending" && <Clock className="w-7 h-7" />}
                {data?.todayStatus === "not_marked" && <CalendarDays className="w-7 h-7" />}
              </div>
              <div>
                <p className="text-lg font-semibold">Today's Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={statusColors[data?.todayStatus || "not_marked"]}>
                    {statusLabels[data?.todayStatus || "not_marked"]}
                  </Badge>
                  {data?.todayStatus === "pending" && (
                    <span className="text-xs text-chart-3">Awaiting confirmation</span>
                  )}
                  {data?.todayCheckIn && (
                    <span className="text-sm text-muted-foreground">
                      Check-in: {data.todayCheckIn}
                    </span>
                  )}
                  {data?.todayCheckOut && (
                    <span className="text-sm text-muted-foreground">
                      Check-out: {data.todayCheckOut}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canMarkPresent && (
                <Button
                  onClick={() => markAttendance.mutate()}
                  disabled={markAttendance.isPending}
                  data-testid="button-mark-present"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {markAttendance.isPending ? "Marking..." : "Mark Present"}
                </Button>
              )}
              {canMarkAttendance && (
                <Button
                  onClick={() => markAttendance.mutate()}
                  disabled={markAttendance.isPending}
                  data-testid="button-mark-attendance"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {markAttendance.isPending ? "Checking in..." : "Check In"}
                </Button>
              )}
              {canCheckOut && (
                <Button
                  variant="secondary"
                  onClick={() => checkOut.mutate()}
                  disabled={checkOut.isPending}
                  data-testid="button-checkout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {checkOut.isPending ? "Checking out..." : "Check Out"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("attendance")} data-testid="card-attendance-rate">
          <CardContent className="p-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <p className="text-3xl font-bold">{attendancePercent}%</p>
              <p className="text-sm text-muted-foreground mt-1">Attendance Rate ({pLabel})</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("present")} data-testid="card-period-stats">
          <CardContent className="p-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">{pLabel}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-chart-2/10 cursor-pointer" onClick={(e) => { e.stopPropagation(); setDetailType("present"); }}>
                  <p className="text-lg font-bold text-chart-2">{stats.present}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="p-2 rounded-md bg-chart-4/10 cursor-pointer" onClick={(e) => { e.stopPropagation(); setDetailType("late"); }}>
                  <p className="text-lg font-bold text-chart-4">{stats.late}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
                <div className="p-2 rounded-md bg-destructive/10 cursor-pointer" onClick={(e) => { e.stopPropagation(); setDetailType("absent"); }}>
                  <p className="text-lg font-bold text-destructive">{stats.absent}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("leave")} data-testid="card-leave-balance">
          <CardContent className="p-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">Leave Balance</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md bg-primary/5 text-center">
                  <p className="text-lg font-bold">{data?.leaveBalance?.remaining || 0}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50 text-center">
                  <p className="text-lg font-bold">{data?.leaveBalance?.used || 0}</p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
              </div>
              {(data?.leaveBalance?.pending || 0) > 0 && (
                <p className="text-xs text-chart-4 text-center">{data.leaveBalance.pending} pending</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(data?.weeklyData || []).map((day: any) => (
              <div
                key={day.date}
                className={`flex-1 min-w-[80px] p-3 rounded-md text-center ${statusColors[day.status || "none"]}`}
              >
                <p className="text-xs font-medium">{day.day}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(day.date).getDate()}
                </p>
                <p className="text-xs mt-2 font-medium">{statusLabels[day.status || "none"]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-download-reports">
              <Download className="w-4 h-4 mr-2" />
              Download Reports
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadMyReport("xlsx")} data-testid="button-download-my-excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              My Report (Excel)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadMyReport("docx")} data-testid="button-download-my-word">
              <FileText className="w-4 h-4 mr-2" />
              My Report (Word)
            </DropdownMenuItem>
            {isTeamLead && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadTeamReport("xlsx")} data-testid="button-download-team-excel">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Team Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadTeamReport("docx")} data-testid="button-download-team-word">
                  <FileText className="w-4 h-4 mr-2" />
                  Team Word
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={!!detailType} onOpenChange={(open) => { if (!open) setDetailType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-detail-title">{detailTitles[detailType || ""] || "Details"}</DialogTitle>
          </DialogHeader>
          {getDetailContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
