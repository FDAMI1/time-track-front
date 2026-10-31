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
import { Loader2, PhoneCall, Plus, Search } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, labelOf, nameOf, peopleOptions, toOptions, type Course, type EnquiryList, type Person } from "@/academy/lib/academy";
import { ListState, Pager, Picker, StatusBadge } from "@/academy/components/common";
import EnquiryDialog from "@/academy/components/EnquiryDialog";

const EMPTY = { name: "", phone: "", email: "", courseId: "", source: "walk_in", assignedTo: "", nextFollowUpDate: "", note: "" };

export default function EnquiriesPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [due, setDue] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState("");
  const canAssign = user?.role !== "teacher";
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (source) params.set("source", source);
  if (due) params.set("due", "true");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/enquiries", params.toString()],
    queryFn: () => api.get<EnquiryList>(`/api/enquiries?${params}`),
  });
  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses") });
  const { data: staff } = useQuery({
    queryKey: ["/api/enquiries/staff"],
    queryFn: () => api.get<Person[]>("/api/enquiries/staff"),
    enabled: canAssign,
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/enquiries", Object.fromEntries(Object.entries(form).filter(([, value]) => value))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Enquiry added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const enquiries = data?.enquiries || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enquiries</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} enquiries</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-enquiry"><Plus className="w-4 h-4 mr-2" />New Enquiry</Button>
      </div>

      <button
        type="button"
        className={`rounded-lg border p-4 text-left transition-colors w-full sm:w-56 ${due ? "bg-accent border-primary" : "bg-card hover:bg-accent"}`}
        onClick={() => { setDue(!due); setPage(1); }}
        aria-pressed={due}
        data-testid="tile-follow-ups-due"
      >
        <p className="text-2xl font-bold">{data?.dueCount ?? 0}</p>
        <p className="text-xs text-muted-foreground mt-1">Follow-ups due</p>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem_11rem] gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, phone or email" aria-label="Search enquiries" value={q} onChange={(e) => filter(setQ)(e.target.value)} data-testid="input-enquiry-search" />
        </div>
        <Picker label="Status" value={status} onChange={filter(setStatus)} options={toOptions(ENQUIRY_STATUSES)} allLabel="All statuses" testId="filter-enquiry-status" />
        <Picker label="Source" value={source} onChange={filter(setSource)} options={toOptions(ENQUIRY_SOURCES)} allLabel="All sources" testId="filter-enquiry-source" />
      </div>

      <ListState isLoading={isLoading} error={error} isEmpty={enquiries.length === 0} emptyText="No enquiries found" icon={PhoneCall}>
        <div className="space-y-2">
          {enquiries.map((enquiry) => (
            <Card key={enquiry._id} data-testid={`card-enquiry-${enquiry._id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" className="font-medium hover:underline text-left" onClick={() => setOpenId(enquiry._id)} data-testid={`button-open-enquiry-${enquiry._id}`}>{enquiry.name}</button>
                  <StatusBadge status={enquiry.status} />
                  {enquiry.nextFollowUpDate && data && enquiry.nextFollowUpDate <= data.today && ["new", "contacted", "follow_up"].includes(enquiry.status) && (
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
            <DialogTitle>New Enquiry</DialogTitle>
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
              <Picker label="Course of interest" value={form.courseId} onChange={(v) => set("courseId", v)} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-enquiry-course" />
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
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Enquiry
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {openId && <EnquiryDialog id={openId} staff={staff} canAssign={canAssign} onClose={() => setOpenId("")} />}
    </div>
  );
}
