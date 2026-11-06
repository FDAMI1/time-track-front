import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { downloadAuthorized } from "@/lib/download";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText } from "lucide-react";

interface Row {
  _id: string; name: string; role: string; isActive: boolean;
  approvedMinutes: number | null; manualPending: number | null; manualRejected: number | null; sessions: number; sessionMinutes: number;
  present: number | null; late: number | null; absent: number | null;
  leadsAssigned: number | null; leadsConverted: number | null; calls: number | null;
  ticketsRaised: number | null; ticketsResolved: number | null; ticketReplies: number | null;
  lecturesTaught?: number; studentsMarked?: number;
}

const h = (m: number | null) => (m == null ? "—" : `${Math.floor(m / 60)}h ${m % 60}m`);
const n = (v: number | null | undefined) => (v == null ? "—" : v);

// Performance for a date range: one row per person the viewer may follow (admins: everyone,
// managers: their team), with downloads for the same data and the attendance reports.
export default function ReportsPage() {
  const api = useMcqApi();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [range, setRange] = useState({ from: "", to: "" });
  const [role, setRole] = useState("all");
  const q = [range.from && `from=${range.from}`, range.to && `to=${range.to}`, role !== "all" && `role=${role}`].filter(Boolean).join("&");
  const { data, isLoading, error } = useQuery({ queryKey: ["/api/performance", q], queryFn: () => api.get<Row[]>(`/api/performance${q ? `?${q}` : ""}`) });
  const download = (path: string, name: string) => downloadAuthorized(path, token, name).catch((err: Error) => toast({ title: "Download failed", description: err.message, variant: "destructive" }));
  const dates = range.from && range.to ? `from=${range.from}&to=${range.to}` : "period=monthly";
  const canTeamAttendance = user?.role === "org_admin" || user?.permissions?.teamReports === true;
  const teachers = (data || []).some((r) => r.role === "teacher");

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Hours, sessions, attendance, leads and tickets for each person</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label htmlFor="report-from" className="text-xs">From</Label><Input id="report-from" type="date" className="w-[150px]" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} data-testid="input-report-from" /></div>
          <div><Label htmlFor="report-to" className="text-xs">To</Label><Input id="report-to" type="date" className="w-[150px]" min={range.from || undefined} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} data-testid="input-report-to" /></div>
          <div className="w-36">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-report-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="manager">Managers</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => download(`/api/performance/export.xlsx${q ? `?${q}` : ""}`, "performance.xlsx")} data-testid="button-performance-excel"><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading && <Skeleton className="h-40 m-4" />}
          {error && <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>}
          {data && !data.length && <p className="p-6 text-sm text-muted-foreground text-center">Nobody to report on for this choice.</p>}
          {!!data?.length && (
            <table className="w-full text-sm min-w-[900px]" data-testid="table-performance">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="p-2">Person</th><th className="p-2">Approved time</th><th className="p-2">Manual pending / rejected</th><th className="p-2">Sessions</th>
                  <th className="p-2">Present / late / absent</th><th className="p-2">Leads (converted)</th><th className="p-2">Calls</th><th className="p-2">Tickets raised / resolved</th>
                  {teachers && <th className="p-2">Lectures taught</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r._id} className="border-b last:border-0" data-testid={`row-performance-${r._id}`}>
                    <td className="p-2"><Link href={`/members/${r._id}`} className="font-medium hover:underline">{r.name}</Link><span className="block text-xs text-muted-foreground capitalize">{r.role}{r.isActive ? "" : " · inactive"}</span></td>
                    <td className="p-2">{h(r.approvedMinutes)}</td>
                    <td className="p-2">{n(r.manualPending)} / {n(r.manualRejected)}</td>
                    <td className="p-2">{r.sessions} · {h(r.sessionMinutes)}</td>
                    <td className="p-2">{n(r.present)} / {n(r.late)} / {n(r.absent)}</td>
                    <td className="p-2">{n(r.leadsAssigned)} ({n(r.leadsConverted)})</td>
                    <td className="p-2">{n(r.calls)}</td>
                    <td className="p-2">{n(r.ticketsRaised)} / {n(r.ticketsResolved)}</td>
                    {teachers && <td className="p-2">{r.role === "teacher" ? `${n(r.lecturesTaught)} · ${n(r.studentsMarked)} marks` : ""}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Other reports</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {canTeamAttendance && (
            <>
              <Button variant="outline" size="sm" onClick={() => download(`/api/reports/team?${dates}&format=xlsx`, "team-attendance.xlsx")} data-testid="button-team-attendance-excel"><FileSpreadsheet className="w-4 h-4 mr-1" />Team attendance (Excel)</Button>
              <Button variant="outline" size="sm" onClick={() => download(`/api/reports/team?${dates}&format=docx`, "team-attendance.docx")}><FileText className="w-4 h-4 mr-1" />Team attendance (Word)</Button>
            </>
          )}
          {user?.organizationId?.type === "academy" && <Button variant="outline" size="sm" asChild><Link href="/progress">Student progress reports</Link></Button>}
          <Button variant="outline" size="sm" asChild><Link href="/tickets/reports">Ticket reports</Link></Button>
          <Button variant="outline" size="sm" asChild><Link href="/enquiries">Lead export</Link></Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Attendance downloads use the From/To dates when both are set, otherwise this month.</p>
    </div>
  );
}
