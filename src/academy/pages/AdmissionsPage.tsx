import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, Loader2, Plus, Search } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { ADMISSION_STATUSES, nameOf, toOptions, type AdmissionList, type Batch, type Course, type EnrolResult, type Enquiry } from "@/academy/lib/academy";
import { ListState, Pager, Picker, StatusBadge } from "@/academy/components/common";

const EMPTY = { enquiryId: "", firstName: "", lastName: "", email: "", phone: "", parentPhone: "", education: "", courseId: "", batchId: "", notes: "" };
type Field = keyof typeof EMPTY;

export default function AdmissionsPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const enquiryId = new URLSearchParams(search).get("enquiry") || "";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  const [enrolled, setEnrolled] = useState<EnrolResult | null>(null);
  const isAdmin = user?.role === "org_admin";
  const set = (field: Field, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admissions", params.toString()],
    queryFn: () => api.get<AdmissionList>(`/api/admissions?${params}`),
  });
  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses") });
  const { data: batches } = useQuery({ queryKey: ["/api/batches"], queryFn: () => api.get<Batch[]>("/api/batches") });
  const { data: enquiry } = useQuery({
    queryKey: ["/api/enquiries", "detail", enquiryId],
    queryFn: () => api.get<Enquiry>(`/api/enquiries/${enquiryId}`),
    enabled: !!enquiryId,
  });

  // "Start Application" on an enquiry lands here with its details filled in.
  useEffect(() => {
    if (!enquiry) return;
    const [firstName, ...rest] = enquiry.name.split(/\s+/);
    setForm({ ...EMPTY, enquiryId: enquiry._id, firstName, lastName: rest.join(" "), email: enquiry.email, phone: enquiry.phone, courseId: enquiry.courseId?._id || "" });
    setCreateOpen(true);
  }, [enquiry]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const create = useMutation({
    mutationFn: () => api.post("/api/admissions", Object.fromEntries(Object.entries(form).filter(([, value]) => value))),
    onSuccess: () => { refresh(); setCreateOpen(false); setForm(EMPTY); toast({ title: "Application added" }); },
    onError: failed,
  });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => api.post(`/api/admissions/${id}/review`, { decision }),
    onSuccess: refresh,
    onError: failed,
  });
  const enrol = useMutation({
    mutationFn: (id: string) => api.post<EnrolResult>(`/api/admissions/${id}/enrol`),
    onSuccess: (result) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEnrolled(result);
    },
    onError: failed,
  });

  const courseBatches = (batches || []).filter((b) => b.courseId?._id === form.courseId);
  const admissions = data?.admissions || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Admissions</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} applications</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-application"><Plus className="w-4 h-4 mr-2" />New Application</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email or phone" aria-label="Search applications" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} data-testid="input-admission-search" />
        </div>
        <Picker label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={toOptions(ADMISSION_STATUSES)} allLabel="All statuses" testId="filter-admission-status" />
      </div>

      <ListState isLoading={isLoading} error={error} isEmpty={admissions.length === 0} emptyText="No applications found" icon={GraduationCap}>
        <div className="space-y-2">
          {admissions.map((a) => (
            <Card key={a._id} data-testid={`card-admission-${a._id}`}>
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.firstName} {a.lastName}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 break-words">
                    {[a.email, a.phone, a.courseId?.title, a.batchId?.batchName, a.parentPhone && `Parent ${a.parentPhone}`, a.status === "enrolled" && (a.studentId?.username || nameOf(a.studentId))].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    {a.status === "applied" && (
                      <>
                        <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: a._id, decision: "approved" })} data-testid={`button-approve-${a._id}`}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: a._id, decision: "rejected" })} data-testid={`button-reject-${a._id}`}>Reject</Button>
                      </>
                    )}
                    {a.status === "approved" && (
                      <Button size="sm" disabled={enrol.isPending} onClick={() => enrol.mutate(a._id)} data-testid={`button-enrol-${a._id}`}>
                        {enrol.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enrol
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ListState>

      <Pager page={page} pages={data?.pages || 1} onChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Application</DialogTitle>
            <DialogDescription>{form.enquiryId ? "Filled in from the enquiry. Check the details." : "Enter the student's details."}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([["firstName", "First name", true], ["lastName", "Last name", true], ["email", "Email", true], ["phone", "Phone", false], ["parentPhone", "Parent WhatsApp", false], ["education", "Education", false]] as [Field, string, boolean][]).map(([field, label, required]) => (
                <div className="space-y-1" key={field}>
                  <Label htmlFor={`admission-${field}`}>{label}</Label>
                  <Input id={`admission-${field}`} type={field === "email" ? "email" : "text"} required={required} value={form[field]} onChange={(e) => set(field, e.target.value)} data-testid={`input-admission-${field}`} />
                </div>
              ))}
              <Picker label="Course" value={form.courseId} onChange={(v) => setForm((f) => ({ ...f, courseId: v, batchId: "" }))} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-admission-course" />
              <Picker label="Batch" value={form.batchId} onChange={(v) => set("batchId", v)} options={courseBatches.map((b) => ({ value: b._id, label: b.batchName }))} placeholder={form.courseId ? "Choose" : "Choose a course first"} testId="select-admission-batch" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admission-notes">Notes</Label>
              <Textarea id="admission-notes" rows={2} maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending || !form.batchId} data-testid="button-submit-application">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Application
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrolled} onOpenChange={(open) => { if (!open) setEnrolled(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{enrolled?.alreadyEnrolled ? "Already enrolled" : "Student enrolled"}</DialogTitle>
            <DialogDescription>
              {enrolled?.tempPassword ? "Copy this password now. It won't be shown again, and the student must change it at first sign-in." : "This student already has an account. Reset the password on the Members page if needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1 break-all">
            <p>{enrolled?.student.name}</p>
            <p>Username: <span className="font-mono" data-testid="text-enrolled-username">{enrolled?.student.username}</span></p>
            {enrolled?.tempPassword && <p>Temporary password: <span className="font-mono" data-testid="text-temp-password">{enrolled.tempPassword}</span></p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
