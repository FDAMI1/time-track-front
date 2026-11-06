import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { downloadAuthorized } from "@/lib/download";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImage } from "@/components/remote-image";
import { ArrowLeft, Camera, FileSpreadsheet, FileText } from "lucide-react";
import { hoursOf, profilePdf, type MemberProfile } from "@/lib/memberProfile";

const Stat = ({ label, value, testId }: { label: string; value: string | number; testId?: string }) => (
  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold" data-testid={testId}>{value}</p></div>
);
const Section = ({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) => (
  <Card data-testid={testId}><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{children}</CardContent></Card>
);
const time = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

// One member's full profile. The server returns only the sections this viewer may see,
// all limited to the one date range chosen at the top.
export default function MemberProfilePage() {
  const [, params] = useRoute("/members/:id");
  const id = params?.id || "";
  const api = useMcqApi();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [range, setRange] = useState({ from: "", to: "" });
  const q = [range.from && `from=${range.from}`, range.to && `to=${range.to}`].filter(Boolean).join("&");
  const { data, isLoading, error } = useQuery({ queryKey: ["/api/members", id, "profile", q], queryFn: () => api.get<MemberProfile>(`/api/members/${id}/profile${q ? `?${q}` : ""}`), enabled: !!id });
  const photoInput = useRef<HTMLInputElement>(null);
  const photo = useMutation({
    mutationFn: (file: File) => { const form = new FormData(); form.append("photo", file); return api.post(`/api/members/${id}/photo`, form); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/members", id] }); toast({ title: "Photo saved" }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (error || !data) return <div className="p-6"><p className="text-destructive">{(error as Error)?.message || "Member not found"}</p></div>;
  const { member: m, sections: s } = data;
  const canPhoto = user?.role === "org_admin" || user?._id === m._id;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Link href="/members" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"><ArrowLeft className="w-4 h-4" />Members</Link>
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="relative w-20 h-20 shrink-0">
            <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xl font-semibold">
              <RemoteImage src={m.photoUrl || ""} alt={`${m.firstName} ${m.lastName}`} className="w-full h-full object-cover" fallback={<span>{(m.firstName?.[0] || "") + (m.lastName?.[0] || "")}</span>} />
            </div>
            {canPhoto && (
              <>
                <input ref={photoInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) photo.mutate(f); e.target.value = ""; }} data-testid="input-member-photo" />
                <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full" aria-label="Change photo" disabled={photo.isPending} onClick={() => photoInput.current?.click()}><Camera className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold" data-testid="text-profile-name">{m.firstName} {m.lastName}</h1>
            <p className="text-sm text-muted-foreground break-all">@{m.username}{m.userId ? ` · ID ${m.userId}` : ""}{m.email ? ` · ${m.email}` : ""}{m.phone ? ` · ${m.phone}` : ""}</p>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              <Badge variant="secondary" className="capitalize">{m.role.replace("_", " ")}</Badge>
              <Badge variant={m.isActive ? "outline" : "destructive"}>{m.isActive ? "Active" : "Inactive"}</Badge>
              <span className="text-xs text-muted-foreground">{m.organizationId?.name} · joined {new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex gap-2 items-end flex-wrap">
            <div><Label htmlFor="profile-from" className="text-xs">From</Label><Input id="profile-from" type="date" className="w-[150px]" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} data-testid="input-profile-from" /></div>
            <div><Label htmlFor="profile-to" className="text-xs">To</Label><Input id="profile-to" type="date" className="w-[150px]" min={range.from || undefined} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} data-testid="input-profile-to" /></div>
            <Button variant="outline" size="sm" onClick={() => downloadAuthorized(`/api/members/${id}/profile.xlsx${q ? `?${q}` : ""}`, token, "profile.xlsx").catch((err: Error) => toast({ title: "Download failed", description: err.message, variant: "destructive" }))} data-testid="button-profile-excel"><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => profilePdf(data)} data-testid="button-profile-pdf"><FileText className="w-4 h-4 mr-1" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {s.timeTracking && (
          <Section title="Time Tracking" testId="section-time">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Approved hours" value={hoursOf(s.timeTracking.approvedMinutes)} testId="stat-approved-hours" />
              <Stat label="Manual approved" value={s.timeTracking.manual.approved} />
              <Stat label="Waiting for approval" value={s.timeTracking.manual.pending} testId="stat-pending-entries" />
              <Stat label="Rejected" value={s.timeTracking.manual.rejected} />
            </div>
            {!!s.timeTracking.daily.length && (
              <ul className="text-sm divide-y max-h-48 overflow-y-auto">{s.timeTracking.daily.map((d) => <li key={d.date} className="flex justify-between py-1"><span>{d.date}</span><span className="font-medium">{hoursOf(d.minutes)}</span></li>)}</ul>
            )}
          </Section>
        )}
        {s.sessions && (
          <Section title="Sessions" testId="section-sessions">
            <div className="grid grid-cols-2 gap-2"><Stat label="Sessions" value={s.sessions.count} /><Stat label="Signed in for" value={hoursOf(s.sessions.totalMinutes)} /></div>
            <ul className="text-sm divide-y max-h-48 overflow-y-auto">
              {s.sessions.sessions.map((r, i) => <li key={i} className="py-1 flex justify-between gap-2 flex-wrap"><span>{time(r.loginAt)} → {r.logoutAt ? time(r.logoutAt) : <span className="text-muted-foreground">last seen {time(r.lastSeenAt)}</span>}</span><span className="font-medium">{hoursOf(r.minutes)}</span></li>)}
            </ul>
          </Section>
        )}
        {s.attendance && (
          <Section title="Daily Attendance" testId="section-attendance">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Present" value={s.attendance.present || 0} /><Stat label="Late" value={s.attendance.late || 0} />
              <Stat label="Absent" value={s.attendance.absent || 0} /><Stat label="Records" value={s.attendance.total} />
            </div>
          </Section>
        )}
        {s.leads && (
          <Section title="CRM Leads" testId="section-leads">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Assigned" value={s.leads.assigned} /><Stat label="New" value={s.leads.new} /><Stat label="Hot" value={s.leads.hot} /><Stat label="Converted" value={s.leads.converted} />
              <Stat label="Follow-ups due" value={s.leads.pendingFollowUps} /><Stat label="Follow-ups done" value={s.leads.completedFollowUps} /><Stat label="Calls logged" value={s.leads.calls} testId="stat-calls" /><Stat label="Notes" value={s.leads.notes + s.leads.discussions} />
              <Stat label="Transferred out" value={s.leads.transferredOut} /><Stat label="Transferred in" value={s.leads.transferredIn} /><Stat label="Owned now" value={s.leads.currentlyOwned} />
            </div>
          </Section>
        )}
        {s.tickets && (
          <Section title="Tickets" testId="section-tickets">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Raised" value={s.tickets.raised} testId="stat-tickets-raised" /><Stat label="Assigned now" value={s.tickets.currentlyAssigned} /><Stat label="Pending" value={s.tickets.pending} /><Stat label="Resolved" value={s.tickets.resolved} />
              <Stat label="Replies" value={s.tickets.replies} /><Stat label="Internal notes" value={s.tickets.internalNotes} /><Stat label="Attachments" value={s.tickets.attachments} /><Stat label="Transfers" value={s.tickets.transfersMade} />
            </div>
            {!!s.tickets.tickets.length && <ul className="text-sm divide-y">{s.tickets.tickets.map((t) => <li key={t._id} className="py-1 flex justify-between gap-2"><Link href={`/tickets/${t._id}`} className="hover:underline truncate">{t.ticketKey} · {t.subject}</Link><Badge variant="outline">{t.status}</Badge></li>)}</ul>}
          </Section>
        )}
        {s.progress && (
          <Section title="Student Progress" testId="section-progress">
            {s.progress.courses.map((c) => (
              <div key={c.batchId} className="space-y-1">
                <p className="text-sm font-medium">{c.course} <span className="text-muted-foreground font-normal">· {c.batchName}</span></p>
                <div className="flex items-center gap-2"><Progress value={c.progress} className="flex-1" aria-label={`${c.course} progress`} /><span className="text-sm font-semibold">{c.progress}%</span></div>
                <p className="text-xs text-muted-foreground">{c.completed} of {c.totalPortion} topics · {c.pending} pending</p>
              </div>
            ))}
            {!!s.progress.pending.length && <p className="text-xs text-amber-600">Pending: {s.progress.pending.map((t) => `${t.topicTitle} (${t.originalDate})`).join(", ")}</p>}
          </Section>
        )}
        {s.mcq && (
          <Section title="MCQ Progress" testId="section-mcq">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><Stat label="Assigned" value={s.mcq.assigned} /><Stat label="Completed" value={s.mcq.completed} /><Stat label="Pending" value={s.mcq.pending} /><Stat label="Missed" value={s.mcq.missed} /></div>
            <ul className="text-sm divide-y">{s.mcq.tests.map((t) => <li key={t.testId} className="py-1 flex justify-between gap-2"><span>{t.title}</span><span className="text-muted-foreground">{t.totalMarks ? `${t.score}/${t.totalMarks} (${t.percentage}%)` : t.state}</span></li>)}</ul>
          </Section>
        )}
      </div>
      {!Object.keys(s).length && <p className="text-sm text-muted-foreground">Nothing to show for this member with your access.</p>}
    </div>
  );
}
