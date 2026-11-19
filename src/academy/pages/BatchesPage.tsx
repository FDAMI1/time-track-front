import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Layers, Loader2, Pencil, Plus, Search, Users } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { nameOf, peopleOptions, toOptions, type Batch, type BatchStatus, type Course, type Person } from "@/academy/lib/academy";
import { ListState, Picker, StatusBadge } from "@/academy/components/common";

const STATUSES: BatchStatus[] = ["upcoming", "active", "completed", "cancelled"];
const TONE: Partial<Record<BatchStatus, string>> = { upcoming: "bg-chart-1/10 text-chart-1", active: "bg-chart-2/10 text-chart-2" };
const EMPTY = { courseId: "", batchName: "", startDate: "", endDate: "", schedule: "", status: "upcoming" as BatchStatus, teacherId: "", students: [] as string[] };
type Form = typeof EMPTY;

const idOf = (ref?: { _id: string } | null) => ref?._id || "";

function BatchDialog({ batch, isAdmin, open, onClose }: { batch: Batch | null; isAdmin: boolean; open: boolean; onClose: () => void }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [studentSearch, setStudentSearch] = useState("");
  const set = <K extends keyof Form>(field: K, value: Form[K]) => setForm((f) => ({ ...f, [field]: value }));

  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses"), enabled: open });
  const { data: people } = useQuery({
    queryKey: ["/api/batches/people"],
    queryFn: () => api.get<{ students: Person[]; teachers: Person[] }>("/api/batches/people"),
    enabled: open,
  });

  // Fill the form each time the dialog opens, from the batch being edited or empty.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = open ? batch?._id || "new" : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (key) {
      setStudentSearch("");
      setForm(batch ? {
        courseId: idOf(batch.courseId), batchName: batch.batchName, startDate: batch.startDate || "", endDate: batch.endDate || "",
        schedule: batch.schedule || "", status: batch.status || "upcoming", teacherId: idOf(batch.teacherId), students: (batch.students || []).map((s) => s._id),
      } : EMPTY);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { batchName: form.batchName.trim(), startDate: form.startDate, endDate: form.endDate, schedule: form.schedule, status: form.status, students: form.students };
      if (batch) return api.put<Batch>(`/api/batches/${batch._id}`, body);
      return api.post<Batch>("/api/batches", { ...body, courseId: form.courseId, ...(isAdmin ? { teacherId: form.teacherId } : {}) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      toast({ title: batch ? "Batch updated" : "Batch created", description: form.batchName.trim() });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Batch not saved", description: err.message, variant: "destructive" }),
  });

  const students = people?.students || [];
  const term = studentSearch.trim().toLowerCase();
  const shown = term ? students.filter((s) => `${nameOf(s)} ${s.userId || ""}`.toLowerCase().includes(term)) : students;
  const toggle = (id: string, on: boolean) => set("students", on ? [...form.students, id] : form.students.filter((s) => s !== id));
  const ready = !!form.batchName.trim() && !!form.startDate && !!form.endDate && form.endDate >= form.startDate
    && (!!batch || (!!form.courseId && (!isAdmin || !!form.teacherId)));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit Batch" : "New Batch"}</DialogTitle>
          <DialogDescription>{batch ? "Course and teacher stay as they are." : "A batch is a group of students taking one course with one teacher."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!batch && <Picker label="Course" value={form.courseId} onChange={(v) => set("courseId", v)} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-batch-course" />}
            {!batch && isAdmin && <Picker label="Teacher" value={form.teacherId} onChange={(v) => set("teacherId", v)} options={peopleOptions(people?.teachers)} testId="select-batch-teacher" />}
            <div className="space-y-1">
              <Label htmlFor="batch-name">Batch name</Label>
              <Input id="batch-name" required maxLength={120} value={form.batchName} onChange={(e) => set("batchName", e.target.value)} data-testid="input-batch-name" />
            </div>
            <Picker label="Status" value={form.status} onChange={(v) => set("status", v as BatchStatus)} options={toOptions(STATUSES)} testId="select-batch-status" />
            <div className="space-y-1">
              <Label htmlFor="batch-start">Start date</Label>
              <Input id="batch-start" type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} data-testid="input-batch-start" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="batch-end">End date</Label>
              <Input id="batch-end" type="date" required min={form.startDate || undefined} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} data-testid="input-batch-end" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="batch-schedule">Schedule</Label>
              <Input id="batch-schedule" maxLength={300} placeholder="e.g. Mon, Wed, Fri 10:00-12:00" value={form.schedule} onChange={(e) => set("schedule", e.target.value)} data-testid="input-batch-schedule" />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Students ({form.students.length})</legend>
            <Input placeholder="Search students" aria-label="Search students" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} data-testid="input-batch-student-search" />
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {shown.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{students.length ? "No student matches" : "No students in this organization yet"}</p> : shown.map((s) => (
                <label key={s._id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={form.students.includes(s._id)} onCheckedChange={(v) => toggle(s._id, v === true)} data-testid={`checkbox-batch-student-${s._id}`} />
                  <span className="flex-1 truncate">{nameOf(s) || s._id}</span>
                  {s.userId && <span className="text-xs text-muted-foreground">{s.userId}</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || save.isPending} data-testid="button-save-batch">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{batch ? "Save" : "Create Batch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BatchesPage() {
  const { user } = useAuth();
  const api = useMcqApi();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Batch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState<Batch | null>(null);

  const role = user?.role || "";
  const isAdmin = role === "org_admin";
  // The server allows the same: admins any batch, teachers the ones they teach.
  const canEdit = (b: Batch) => isAdmin || (role === "teacher" && idOf(b.teacherId) === user?._id);
  const canCreate = isAdmin || role === "teacher";

  const { data: batches = [], isLoading, error } = useQuery({ queryKey: ["/api/batches"], queryFn: () => api.get<Batch[]>("/api/batches") });
  const archive = useMutation({
    mutationFn: (b: Batch) => api.delete(`/api/batches/${b._id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/batches"] }); toast({ title: "Batch archived" }); },
    onError: (err: Error) => toast({ title: "Not archived", description: err.message, variant: "destructive" }),
  });

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return batches.filter((b) => (!status || b.status === status)
      && (!term || `${b.batchName} ${b.courseId?.title || ""} ${nameOf(b.teacherId)}`.toLowerCase().includes(term)));
  }, [batches, search, status]);

  const subtitle = isAdmin || role === "manager" ? "Every batch in your organization"
    : role === "teacher" ? "The batches you teach" : role === "student" ? "The batches you are in" : "Every batch, read only";
  const open = (b: Batch | null) => { setEditing(b); setDialogOpen(true); };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Batches</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {canCreate && <Button onClick={() => open(null)} data-testid="button-new-batch"><Plus className="w-4 h-4 mr-1" />New Batch</Button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search batch, course or teacher" aria-label="Search batches" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-batch-search" />
        </div>
        <Picker label="Status" value={status} onChange={setStatus} options={toOptions(STATUSES)} allLabel="All statuses" testId="select-batch-filter" />
      </div>
      <ListState isLoading={isLoading} error={error} isEmpty={shown.length === 0} emptyText={batches.length ? "No batch matches" : "No batches yet"} icon={Layers}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {shown.map((b) => (
            <Card key={b._id} data-testid={`card-batch-${b._id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.batchName}</p>
                    <p className="text-sm text-muted-foreground truncate">{b.courseId?.title || "No course"}{b.teacherId ? ` · ${nameOf(b.teacherId)}` : ""}</p>
                  </div>
                  <StatusBadge status={b.status || "upcoming"} tone={TONE[b.status || "upcoming"]} />
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
                  <span>{b.startDate} to {b.endDate}</span>
                  {b.schedule && <span>{b.schedule}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{b.students?.length || 0} {b.students?.length === 1 ? "student" : "students"}</span>
                </div>
                {canEdit(b) && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(b)} data-testid={`button-edit-batch-${b._id}`}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setArchiving(b)} data-testid={`button-archive-batch-${b._id}`}>
                        <Archive className="w-3.5 h-3.5 mr-1" />Archive
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ListState>
      <BatchDialog batch={editing} isAdmin={isAdmin} open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <AlertDialog open={!!archiving} onOpenChange={(o) => { if (!o) setArchiving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiving?.batchName}?</AlertDialogTitle>
            <AlertDialogDescription>The batch leaves every list. Its lectures, attendance and student progress stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (archiving) archive.mutate(archiving); setArchiving(null); }} data-testid="button-confirm-archive-batch">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
