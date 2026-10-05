import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, BookOpen, Trash2, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqQuestion, QuestionPayload } from "@/mcq/lib/types";
import QuestionFormDialog from "@/mcq/components/QuestionFormDialog";

const PAGE_SIZE = 20;

export default function McqQuestionsPage() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McqQuestion | null>(null);
  const [subject, setSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (subject !== "all") params.set("subject", subject);
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/questions", page, subject, search],
    queryFn: () => api.get<{ questions: McqQuestion[]; total: number }>(`/api/mcq/questions?${params}`),
  });
  const { data: subjects } = useQuery({
    queryKey: ["/api/mcq/questions", "subjects"],
    queryFn: () => api.get<string[]>("/api/mcq/questions/subjects"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/mcq/questions"] });

  const save = useMutation({
    mutationFn: (payload: QuestionPayload) => (editing ? api.patch(`/api/mcq/questions/${editing._id}`, payload) : api.post("/api/mcq/questions", payload)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: editing ? "Question updated" : "Question created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkSave = useMutation({
    mutationFn: (questions: QuestionPayload[]) => api.post<{ count: number }>("/api/mcq/questions/bulk", { questions }),
    onSuccess: (result) => {
      invalidate();
      setDialogOpen(false);
      toast({ title: `${result.count} questions added to question bank` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/questions/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Question deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Question Bank</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} questions</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-add-question">
          <Plus className="w-4 h-4 mr-2" />Add Question
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search question text..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" data-testid="input-search-questions" />
        </div>
        <Select value={subject} onValueChange={(v) => { setSubject(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-subject-filter"><SelectValue placeholder="All subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {(subjects || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        pending={save.isPending || bulkSave.isPending}
        onSave={(p) => save.mutate(p)}
        onBulkSave={(p) => bulkSave.mutate(p)}
      />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : data && data.questions.length > 0 ? (
        <div className="space-y-3">
          {data.questions.map((q, idx) => (
            <Card key={q._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{q.subject}</Badge>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">{q.topic}</Badge>
                      <span className="text-xs text-muted-foreground">{q.marks} marks</span>
                      {q.negativeMarks > 0 && <span className="text-xs text-destructive">-{q.negativeMarks}</span>}
                    </div>
                    <p className="text-sm font-medium text-foreground" data-testid={`text-question-${q._id}`}>{(page - 1) * PAGE_SIZE + idx + 1}. {q.questionText}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`text-xs px-2.5 py-1.5 rounded-md ${i === q.correctAnswer ? "bg-chart-2/10 text-chart-2 font-medium" : "bg-muted/50 text-muted-foreground"}`}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(q); setDialogOpen(true); }} data-testid={`button-edit-question-${q._id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-question-${q._id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Question</AlertDialogTitle>
                          <AlertDialogDescription>Remove this question from the question bank? Tests that already include it keep their copy of past results.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(q._id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-prev-page"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="button-next-page"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{search || subject !== "all" ? "No questions match your filters" : "No questions yet"}</p>
            <p className="text-muted-foreground/70 text-xs mt-1">Create your first question to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
