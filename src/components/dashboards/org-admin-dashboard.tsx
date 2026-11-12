import { apiFetch, safeJson } from "@/lib/api";
import { downloadAuthorized } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { localDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, UserCheck, UserX, Clock, CalendarOff, TrendingUp, AlertCircle, Download, FileSpreadsheet, FileText, ChevronDown, CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";

const statusBadge: Record<string, string> = {
  present: "bg-chart-2/10 text-chart-2",
  late: "bg-chart-4/10 text-chart-4",
  absent: "bg-destructive/10 text-destructive",
  pending: "bg-chart-3/10 text-chart-3",
};

const periodLabels: Record<string, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
  yearly: "This Year",
};

export default function OrgAdminDashboard() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState("daily");
  const [drilldownType, setDrilldownType] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");

  const orgType = user?.organizationId?.type;

  function downloadReport(format: string, type: "team" | "user" = "team") {
    const url = type === "team"
      ? `/api/reports/team?period=${period}&format=${format}`
      : `/api/reports/user/${selectedMember}?period=${period}&format=${format}`;
    downloadAuthorized(url, token, `report.${format}`).catch((err: Error) =>
      toast({ title: "Report download failed", description: err.message, variant: "destructive" })
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["/api/dashboard/org", period, selectedMember],
    queryFn: async () => {
      let url = `/api/dashboard/org?period=${period}`;
      if (selectedMember) url += `&memberId=${selectedMember}`;
      const res = await apiFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return safeJson(res);
    },
  });

  async function openDrilldown(type: string) {
    setDrilldownType(type);
    setDrilldownLoading(true);
    try {
      const startDate = data?.startDate || localDateString();
      const endDate = data?.endDate || startDate;
      const res = await apiFetch(`/api/dashboard/org/drilldown?type=${type}&startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDrilldownData(await res.json());
      }
    } catch (e) {}
    setDrilldownLoading(false);
  }

  function closeDrilldown() {
    setDrilldownType(null);
    setDrilldownData(null);
  }

  const pLabel = periodLabels[period] || "Today";

  const drilldownTitles: Record<string, string> = {
    total: "Total Members",
    present: `Present ${pLabel}`,
    absent: `Absent ${pLabel}`,
    late: `Late ${pLabel}`,
    pending: `Pending ${pLabel}`,
    pending_leaves: "Pending Leave Requests",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const attendanceRate = data?.totalMembers > 0
    ? Math.round(((data?.presentCount || 0) / Math.max(1, (data?.presentCount || 0) + (data?.absentCount || 0) + (data?.lateCount || 0))) * 100)
    : 0;

  const memberLabel = orgType === "academy" ? "Students" : "Employees";

  const chartTitle = period === "yearly" ? "Monthly Attendance Trend" :
    period === "monthly" ? "Daily Attendance Trend" :
    period === "weekly" ? "Weekly Attendance Trend" : "Today's Attendance";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title" data-testid="text-org-dashboard-title">
            {data?.organization?.name || "Organization"} Dashboard
          </h1>
          <p className="text-muted-foreground">
            {pLabel}'s overview and attendance summary
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data?.allMembers && data.allMembers.length > 0 && (
            <Select value={selectedMember || "all"} onValueChange={(v) => setSelectedMember(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-member-filter">
                <SelectValue placeholder={`Filter ${memberLabel}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {memberLabel}</SelectItem>
                {(data.allMembers || []).map((m: any) => (
                  <SelectItem key={m._id} value={m._id}>{m.firstName} {m.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
      </div>

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
            <DropdownMenuItem onClick={() => downloadReport("xlsx", "team")} data-testid="button-download-team-excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Team Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadReport("docx", "team")} data-testid="button-download-team-word">
              <FileText className="w-4 h-4 mr-2" />
              Team Word
            </DropdownMenuItem>
            {selectedMember && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadReport("xlsx", "user")} data-testid="button-download-member-excel">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Member Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadReport("docx", "user")} data-testid="button-download-member-word">
                  <FileText className="w-4 h-4 mr-2" />
                  Member Word
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrilldown("total")} data-testid="card-total-members">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-members">{data?.totalMembers || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrilldown("present")} data-testid="card-present">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground">Present {pLabel}</p>
                <p className="text-2xl font-bold mt-1 text-chart-2">{data?.presentCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrilldown("absent")} data-testid="card-absent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground">Absent {pLabel}</p>
                <p className="text-2xl font-bold mt-1 text-destructive">{data?.absentCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <UserX className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrilldown("late")} data-testid="card-late">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground">Late {pLabel}</p>
                <p className="text-2xl font-bold mt-1 text-chart-4">{data?.lateCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-chart-4/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDrilldown("pending_leaves")} data-testid="card-pending-leaves">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground">Pending Leaves</p>
                <p className="text-2xl font-bold mt-1 text-chart-3">{data?.pendingLeaves || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-chart-3/10 flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{chartTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {(data?.chartData || []).some((d: { present?: number; late?: number; absent?: number }) => (d.present || 0) + (d.late || 0) + (d.absent || 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.chartData || []}>
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="hsl(142, 76%, 28%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="hsl(37, 91%, 35%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="hsl(0, 84%, 35%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <EmptyState icon={CalendarCheck} title="No attendance recorded yet" description="Check-ins for this period appear here as people mark attendance." testId="state-empty-attendance-chart" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 rounded-md bg-primary/5">
                <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{attendanceRate}%</p>
                <p className="text-sm text-muted-foreground">{pLabel}'s Attendance Rate</p>
              </div>

              {(data?.pendingCount || 0) > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-md bg-chart-3/10 cursor-pointer" onClick={() => openDrilldown("pending")}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-chart-3" />
                    <span className="text-sm text-chart-3 font-medium">Pending Confirmations</span>
                  </div>
                  <Badge variant="secondary" className="bg-chart-3/20 text-chart-3">{data.pendingCount}</Badge>
                </div>
              )}

              <div className="space-y-2">
                {(data?.roleBreakdown || []).map((rb: any) => (
                  <div key={rb._id} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/30">
                    <span className="text-sm capitalize">{rb._id}s</span>
                    <Badge variant="secondary">{rb.count}</Badge>
                  </div>
                ))}
                {(!data?.roleBreakdown || data.roleBreakdown.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!drilldownType} onOpenChange={(open) => { if (!open) closeDrilldown(); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-drilldown-title">{drilldownTitles[drilldownType || ""] || "Details"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {drilldownLoading && (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            )}
            {!drilldownLoading && drilldownData && !["pending_leaves"].includes(drilldownType || "") && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  {drilldownData.count} member(s) — {drilldownData.startDate === drilldownData.endDate ? drilldownData.startDate : `${drilldownData.startDate} to ${drilldownData.endDate}`}
                </p>
                {(drilldownData.members || []).map((m: any, idx: number) => (
                  <div key={m._id || idx} className="flex items-center justify-between p-3 rounded-md bg-muted/30" data-testid={`drilldown-member-${m._id}`}>
                    <div>
                      <p className="text-sm font-medium">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role} {m.username ? `• @${m.username}` : ""}</p>
                    </div>
                    <Badge className={statusBadge[m.status] || "bg-muted text-muted-foreground"}>
                      {m.status === "present" ? "Present" : m.status === "late" ? "Late" : m.status === "pending" ? "Pending" : "Absent"}
                    </Badge>
                  </div>
                ))}
                {drilldownData.members?.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">No members found</p>
                )}
              </div>
            )}
            {!drilldownLoading && drilldownData && drilldownType === "pending_leaves" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">{drilldownData.count} pending request(s)</p>
                {(drilldownData.leaves || []).map((l: any) => (
                  <div key={l._id} className="flex items-center justify-between p-3 rounded-md bg-muted/30" data-testid={`drilldown-leave-${l._id}`}>
                    <div>
                      <p className="text-sm font-medium">{l.userId?.firstName} {l.userId?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{l.startDate} - {l.endDate} • {l.reason}</p>
                    </div>
                    <Badge className="bg-chart-3/10 text-chart-3">Pending</Badge>
                  </div>
                ))}
                {drilldownData.leaves?.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">No pending leaves</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
