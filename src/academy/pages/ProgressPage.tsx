import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { downloadAuthorized } from "@/lib/download";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Trash2, GraduationCap } from "lucide-react";
import { Picker } from "@/academy/components/common";
import StudentProgressView from "@/academy/components/StudentProgressView";
import CourseImage from "@/academy/components/CourseImage";
import { progressPdf, type StudentProgress } from "@/academy/lib/progress";
import type { Batch, Course, CourseTopic } from "@/academy/lib/academy";

interface StudentRow { _id: string; firstName: string; lastName: string; username: string; userId?: string; completed: number; pending: number }

function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex gap-2 items-end flex-wrap">
      <div><Label htmlFor="progress-from" className="text-xs">From</Label><Input id="progress-from" type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="w-[150px]" data-testid="input-progress-from" /></div>
      <div><Label htmlFor="progress-to" className="text-xs">To</Label><Input id="progress-to" type="date" min={from || undefined} value={to} onChange={(e) => onChange(from, e.target.value)} className="w-[150px]" data-testid="input-progress-to" /></div>
      {(from || to) && <Button variant="ghost" size="sm" onClick={() => onChange("", "")}>All dates</Button>}
    </div>
  );
}

const query = (from: string, to: string) => [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join("&");
const periodOf = (from: string, to: string) => (from || to ? `${from || "start"} to ${to || "today"}` : "All dates");

function StudentDetail({ url, canEdit, from, to }: { url: string; canEdit: boolean; from: string; to: string }) {
  const api = useMcqApi();
  const { data, isLoading, error } = useQuery({ queryKey: ["/api/progress", url], queryFn: () => api.get<StudentProgress>(url) });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message || "Couldn't load progress"}</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => progressPdf(data, periodOf(from, to))} data-testid="button-progress-pdf"><FileText className="w-4 h-4 mr-1" />PDF</Button></div>
      <StudentProgressView data={data} canEdit={canEdit} />
    </div>
  );
}

function Syllabus() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [courseId, setCourseId] = useState("");
  const [form, setForm] = useState({ subject: "", title: "" });
  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses") });
  const key = ["/api/progress/courses", courseId, "topics"];
  const { data: topics } = useQuery({ queryKey: key, queryFn: () => api.get<CourseTopic[]>(`/api/progress/courses/${courseId}/topics`), enabled: !!courseId });
  const failed = (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" });
  const add = useMutation({
    mutationFn: () => api.post(`/api/progress/courses/${courseId}/topics`, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); setForm({ subject: form.subject, title: "" }); },
    onError: failed,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/api/progress/topics/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: key }), onError: failed });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">A course's topics are its total portion. Lectures that name a topic complete it for each student marked present.</p>
      <div className="max-w-sm"><Picker label="Course" value={courseId} onChange={setCourseId} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-syllabus-course" /></div>
      {courseId && (
        <>
          {courses?.find((c) => c._id === courseId) && <CourseImage course={courses.find((c) => c._id === courseId)!} />}
          <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); if (form.title.trim()) add.mutate(); }}>
            <Input className="w-40" placeholder="Subject or module" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} aria-label="Subject or module" data-testid="input-topic-subject" />
            <Input className="flex-1 min-w-[180px]" placeholder="Topic" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Topic" data-testid="input-topic-title" />
            <Button type="submit" disabled={!form.title.trim() || add.isPending} data-testid="button-add-topic">Add Topic</Button>
          </form>
          {!topics?.length ? <p className="text-sm text-muted-foreground">No topics yet.</p> : (
            <ol className="divide-y rounded-md border" data-testid="list-syllabus">
              {topics.map((t, i) => (
                <li key={t._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{i + 1}. {t.subject && <span className="text-muted-foreground">{t.subject} · </span>}{t.title}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Remove ${t.title}`} onClick={() => remove.mutate(t._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const { user, token } = useAuth();
  const api = useMcqApi();
  const { toast } = useToast();
  const [range, setRange] = useState({ from: "", to: "" });
  const [batchId, setBatchId] = useState("");
  const [studentId, setStudentId] = useState("");
  const q = query(range.from, range.to);
  const isStudent = user?.role === "student";

  const { data: batches } = useQuery({ queryKey: ["/api/batches"], queryFn: () => api.get<Batch[]>("/api/batches"), enabled: !isStudent });
  const { data: students, isLoading } = useQuery({
    queryKey: ["/api/progress/students", batchId],
    queryFn: () => api.get<StudentRow[]>(`/api/progress/students${batchId ? `?batchId=${batchId}` : ""}`),
    enabled: !isStudent,
  });
  const excel = (params: string, name: string) => downloadAuthorized(`/api/progress/export.xlsx?${params}${q ? `&${q}` : ""}`, token, name)
    .catch((err: Error) => toast({ title: "Download failed", description: err.message, variant: "destructive" }));

  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="page-title">{isStudent ? "My Progress" : "Student Progress"}</h1>
        <p className="text-sm text-muted-foreground">Lecture-wise progress, pending portions and make-ups</p>
      </div>
      <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
    </div>
  );

  if (isStudent) {
    return <div className="p-4 sm:p-6 space-y-4">{header}<StudentDetail url={`/api/progress/me${q ? `?${q}` : ""}`} canEdit={false} from={range.from} to={range.to} /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {header}
      <Tabs defaultValue="students">
        <TabsList><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="syllabus" data-testid="tab-syllabus">Syllabus</TabsTrigger></TabsList>
        <TabsContent value="students" className="space-y-4">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="w-56"><Picker label="Batch" value={batchId} onChange={(v) => { setBatchId(v); setStudentId(""); }} options={(batches || []).map((b) => ({ value: b._id, label: b.batchName }))} allLabel="All batches" testId="select-progress-batch" /></div>
            {batchId && <Button variant="outline" size="sm" onClick={() => excel(`batchId=${batchId}`, "batch-progress.xlsx")} data-testid="button-batch-excel"><FileSpreadsheet className="w-4 h-4 mr-1" />Batch Excel</Button>}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardContent className="p-0">
                {isLoading && <Skeleton className="h-40 m-3" />}
                {!isLoading && !students?.length && <p className="p-6 text-center text-sm text-muted-foreground"><GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />No students here</p>}
                <ul className="divide-y max-h-[60vh] overflow-y-auto" role="listbox" aria-label="Students">
                  {students?.map((s) => (
                    <li key={s._id} role="option" aria-selected={s._id === studentId}>
                      <button type="button" className={`w-full text-left px-3 py-2 hover:bg-muted ${s._id === studentId ? "bg-muted" : ""}`} onClick={() => setStudentId(s._id)} data-testid={`option-student-${s._id}`}>
                        <p className="text-sm font-medium">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground">{s.userId ? `ID ${s.userId} · ` : ""}{s.completed} completed{s.pending ? <Badge variant="outline" className="ml-1 text-[10px] text-amber-600">{s.pending} pending</Badge> : null}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <div className="lg:col-span-2 space-y-3">
              {studentId ? (
                <>
                  <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => excel(`studentId=${studentId}`, "student-progress.xlsx")} data-testid="button-student-excel"><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button></div>
                  <StudentDetail url={`/api/progress/students/${studentId}${q ? `?${q}` : ""}`} canEdit from={range.from} to={range.to} />
                </>
              ) : <p className="text-sm text-muted-foreground p-6 text-center border rounded-md">Choose a student to see their progress</p>}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="syllabus"><Syllabus /></TabsContent>
      </Tabs>
    </div>
  );
}
