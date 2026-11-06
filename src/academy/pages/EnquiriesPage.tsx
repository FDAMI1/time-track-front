import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Loader2, PhoneCall, Plus, Search, Settings, Upload } from "lucide-react";
import { downloadFile, useMcqApi } from "@/mcq/lib/api";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, STAGE_TONES, TELECALLER_ROLES, isOpenLead, labelOf, nameOf, peopleOptions, stageOf, toOptions, type Course, type EnquiryList, type LeadReport, type LeadStage, type Person } from "@/academy/lib/academy";
import { ListState, Pager, Picker, StatusBadge } from "@/academy/components/common";
import EnquiryDialog from "@/academy/components/EnquiryDialog";
import LeadSourcesSheet from "@/academy/components/LeadSourcesSheet";
import ImportLeadsDialog from "@/academy/components/ImportLeadsDialog";

const EMPTY = { name: "", phone: "", email: "", courseId: "", source: "walk_in", assignedTo: "", nextFollowUpDate: "", note: "" };

export default function EnquiriesPage() {
  const api = useMcqApi();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState<LeadStage | "">("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const canAssign = !TELECALLER_ROLES.includes(user?.role || "");
  // A telecaller hands their own leads on only with the admin's "Transfer leads" permission.
  const canTransfer = canAssign || user?.toolAccess?.crmTransfer === true;
  const isAcademy = (user?.organizationId as { type?: string } | undefined)?.type === "academy";
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (source) params.set("source", source);
  if (stage) params.set("stage", stage);
  if (assignee) params.set("assignedTo", assignee);
  if (due) params.set("due", "true");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/enquiries", params.toString()],
    queryFn: () => api.get<EnquiryList>(`/api/enquiries?${params}`),
  });
  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses"), enabled: isAcademy });
  const { data: report } = useQuery({ queryKey: ["/api/enquiries", "report"], queryFn: () => api.get<LeadReport>("/api/enquiries/report"), enabled: canAssign });
  const { data: staff } = useQuery({
    queryKey: ["/api/enquiries/staff"],
    queryFn: () => api.get<Person[]>("/api/enquiries/staff"),
    enabled: canTransfer,
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/enquiries", Object.fromEntries(Object.entries(form).filter(([, value]) => value))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Lead added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const enquiries = data?.enquiries || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} leads</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAssign && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-enquiries"><Upload className="w-4 h-4 mr-2" />Import</Button>
              <Button variant="outline" onClick={() => downloadFile("/api/enquiries/export", token).catch((err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }))} data-testid="button-export-enquiries"><Download className="w-4 h-4 mr-2" />Export</Button>
            </>
          )}
          {user?.role === "org_admin" && <Button variant="outline" size="icon" aria-label="Lead source settings" onClick={() => setSourcesOpen(true)} data-testid="button-lead-sources"><Settings className="w-4 h-4" /></Button>}
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-enquiry"><Plus className="w-4 h-4 mr-2" />New Lead</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["cold", "hot", "dead"] as LeadStage[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-lg border p-4 text-left transition-colors ${stage === s ? "bg-accent border-primary" : "bg-card hover:bg-accent"}`}
            onClick={() => { setStage(stage === s ? "" : s); setPage(1); }}
            aria-pressed={stage === s}
            data-testid={`tile-stage-${s}`}
          >
            <p className="text-2xl font-bold">{data?.stages?.[s] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{s} leads</p>
          </button>
        ))}
        <button
          type="button"
          className={`rounded-lg border p-4 text-left transition-colors ${due ? "bg-accent border-primary" : "bg-card hover:bg-accent"}`}
          onClick={() => { setDue(!due); setPage(1); }}
          aria-pressed={due}
          data-testid="tile-follow-ups-due"
        >
          <p className="text-2xl font-bold">{data?.dueCount ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Follow-ups due</p>
        </button>
      </div>

      {report && report.byAssignee.length > 0 && (
        <Card data-testid="card-telecaller-report">
          <CardContent className="p-4 overflow-x-auto">
            <p className="text-sm font-medium mb-2">By telecaller</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-4 font-medium">Name</th>
                  <th className="py-1 pr-4 font-medium">Open</th>
                  <th className="py-1 pr-4 font-medium">Hot</th>
                  <th className="py-1 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byAssignee.map((row) => (
                  <tr key={row.assignedTo || "none"} className="border-t">
                    <td className="py-1 pr-4">{row.name}</td>
                    <td className="py-1 pr-4">{row.open}</td>
                    <td className="py-1 pr-4">{row.hot}</td>
                    <td className="py-1">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className={`grid grid-cols-1 gap-3 ${canAssign ? "sm:grid-cols-2 lg:grid-cols-[1fr_11rem_11rem_11rem]" : "sm:grid-cols-[1fr_11rem_11rem]"}`}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, phone or email" aria-label="Search enquiries" value={q} onChange={(e) => filter(setQ)(e.target.value)} data-testid="input-enquiry-search" />
        </div>
        <Picker label="Status" value={status} onChange={filter(setStatus)} options={toOptions(ENQUIRY_STATUSES)} allLabel="All statuses" testId="filter-enquiry-status" />
        <Picker label="Source" value={source} onChange={filter(setSource)} options={toOptions(ENQUIRY_SOURCES)} allLabel="All sources" testId="filter-enquiry-source" />
        {canAssign && <Picker label="Telecaller" value={assignee} onChange={filter(setAssignee)} options={peopleOptions(staff)} allLabel="All telecallers" testId="filter-enquiry-assignee" />}
      </div>

      <ListState isLoading={isLoading} error={error} isEmpty={enquiries.length === 0} emptyText="No leads found" icon={PhoneCall}>
        <div className="space-y-2">
          {enquiries.map((enquiry) => (
            <Card key={enquiry._id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setOpenId(enquiry._id)} data-testid={`card-enquiry-${enquiry._id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" className="font-medium hover:underline text-left" onClick={() => setOpenId(enquiry._id)} data-testid={`button-open-enquiry-${enquiry._id}`}>{enquiry.name}</button>
                  <StatusBadge status={enquiry.status} tone={STAGE_TONES[enquiry.stage || stageOf(enquiry.status)]} />
                  {enquiry.ticketId && <span className="text-xs text-muted-foreground">{enquiry.ticketId.ticketKey}</span>}
                  {enquiry.nextFollowUpDate && data && enquiry.nextFollowUpDate <= data.today && isOpenLead(enquiry.status) && (
                    <span className="text-xs font-medium text-destructive">Follow-up due</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {[enquiry.phone, enquiry.email, enquiry.courseId?.title, labelOf(enquiry.source), nameOf(enquiry.assignedTo) || "Unassigned"].filter(Boolean).join(" · ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ListState>

      <Pager page={page} pages={data?.pages || 1} onChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
            <DialogDescription>Enter a phone number or an email so someone can follow up.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="enquiry-name">Name</Label>
              <Input id="enquiry-name" required maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="input-enquiry-name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="enquiry-phone">Phone</Label>
                <Input id="enquiry-phone" maxLength={40} value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="input-enquiry-phone" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="enquiry-email">Email</Label>
                <Input id="enquiry-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="input-enquiry-email" />
              </div>
              {isAcademy && <Picker label="Course of interest" value={form.courseId} onChange={(v) => set("courseId", v)} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-enquiry-course" />}
              <Picker label="Source" value={form.source} onChange={(v) => set("source", v)} options={toOptions(ENQUIRY_SOURCES)} testId="select-enquiry-source" />
              {canAssign && <Picker label="Assigned to" value={form.assignedTo} onChange={(v) => set("assignedTo", v)} options={peopleOptions(staff)} testId="select-enquiry-assignee" />}
              <div className="space-y-1">
                <Label htmlFor="enquiry-follow-up">Next follow-up</Label>
                <Input id="enquiry-follow-up" type="date" value={form.nextFollowUpDate} onChange={(e) => set("nextFollowUpDate", e.target.value)} data-testid="input-enquiry-follow-up" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="enquiry-note">Note</Label>
              <Textarea id="enquiry-note" rows={3} maxLength={2000} value={form.note} onChange={(e) => set("note", e.target.value)} data-testid="input-enquiry-note" />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-enquiry">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Lead
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <LeadSourcesSheet open={sourcesOpen} onOpenChange={setSourcesOpen} />
      {canAssign && <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} />}
      {openId && <EnquiryDialog id={openId} staff={staff} canAssign={canTransfer} onClose={() => setOpenId("")} />}
    </div>
  );
}
