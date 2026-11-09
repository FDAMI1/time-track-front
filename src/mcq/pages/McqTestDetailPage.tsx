import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BookOpen, Clock, FileCheck, Shuffle, Eye, ArrowLeft, Award, Plus, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle, Download, FileText, Camera, Users, Home, UserMinus, Share2, Copy } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { isMcqAdmin } from "@/mcq/lib/roles";
import { pctOf, scoreVariant, type McqAttemptSummary, type McqPdfTemplate, type McqQuestion, type McqTestDetail, type PublishRule, type QuestionPayload } from "@/mcq/lib/types";
import { generateTestPDF } from "@/mcq/lib/testPdf";
import QuestionFormDialog from "@/mcq/components/QuestionFormDialog";
import QuestionBankPicker from "@/mcq/components/QuestionBankPicker";
import { AssignStudentsDialog, ManageAssignmentsDialog, ShareTestDialog } from "@/mcq/components/TestAssignDialogs";
import { externalTestLink } from "./McqTestsPage";
import TestWindowFields, { fromLocalInput, toLocalInput } from "@/mcq/components/TestWindowFields";

const MINIMUM_QUESTIONS = 10;

export default function McqTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isAdmin = isMcqAdmin(user?.role);

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<McqQuestion | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"class" | "home">("class");
  const [manageOpen, setManageOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", duration: 30, maxAttempts: 1, publishRule: "INSTANT" as PublishRule, startDate: "", endDate: "" });

  const { data: test, isLoading } = useQuery({
    queryKey: ["/api/mcq/tests", id],
    queryFn: () => api.get<McqTestDetail>(`/api/mcq/tests/${id}`),
  });
  const { data: attempts } = useQuery({
    queryKey: ["/api/mcq/tests", id, "attempts"],
    queryFn: () => api.get<McqAttemptSummary[]>(`/api/mcq/tests/${id}/attempts`),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/mcq/pdf-templates"],
    queryFn: () => api.get<McqPdfTemplate[]>("/api/mcq/pdf-templates"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] });
  };
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const saveQuestion = useMutation({
    mutationFn: async (payload: QuestionPayload) => {
      if (editingQuestion) return api.patch(`/api/mcq/questions/${editingQuestion._id}`, payload);
      const question = await api.post<McqQuestion>("/api/mcq/questions", payload);
      await api.post(`/api/mcq/tests/${id}/questions`, { questionIds: [question._id] });
      return question;
    },
    onSuccess: () => { refresh(); queryClient.invalidateQueries({ queryKey: ["/api/mcq/questions"] }); setQuestionDialogOpen(false); toast({ title: editingQuestion ? "Question updated" : "Question added to test" }); },
    onError,
  });

  const bulkAdd = useMutation({
    mutationFn: async (questions: QuestionPayload[]) => {
      const result = await api.post<{ questions: McqQuestion[]; count: number }>("/api/mcq/questions/bulk", { questions });
      await api.post(`/api/mcq/tests/${id}/questions`, { questionIds: result.questions.map((q) => q._id) });
      return result;
    },
    onSuccess: (result) => { refresh(); queryClient.invalidateQueries({ queryKey: ["/api/mcq/questions"] }); setQuestionDialogOpen(false); toast({ title: `${result.count} questions added to test` }); },
    onError,
  });

  const removeQuestion = useMutation({
    mutationFn: (questionId: string) => api.delete(`/api/mcq/tests/${id}/questions/${questionId}`),
    onSuccess: () => { refresh(); toast({ title: "Question removed from test" }); },
    onError,
  });

  const updateTest = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/api/mcq/tests/${id}`, data),
    onSuccess: (_d, vars) => {
      refresh();
      setEditInfoOpen(false);
      if (vars.status === "ACTIVE") toast({ title: "Test activated successfully" });
      else if (vars.proctorWarningLimit !== undefined) toast({ title: `Warning limit updated to ${vars.proctorWarningLimit}` });
      else toast({ title: "Test details updated" });
    },
    onError,
  });

  const publishResults = useMutation({
    mutationFn: (published: boolean) => api.post<{ resultsPublished: boolean }>(`/api/mcq/tests/${id}/publish-results`, { published }),
    onSuccess: (data) => { refresh(); toast({ title: data.resultsPublished ? "Results published" : "Results hidden" }); },
    onError,
  });

  const deleteTest = useMutation({
    mutationFn: () => api.delete(`/api/mcq/tests/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] }); toast({ title: "Test deleted" }); navigate("/tests"); },
    onError,
  });

  const handleDownloadPDF = async (templateId: string | null) => {
    if (!test) return;
    setDownloading(true);
    try {
      let base64: string | null = null;
      if (templateId) base64 = (await api.get<McqPdfTemplate>(`/api/mcq/pdf-templates/${templateId}`)).base64 || null;
      generateTestPDF(test, base64);
      setTemplatePickerOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!test) return <div className="text-muted-foreground">Test not found</div>;

  const questionCount = test.questions?.length || 0;
  const canActivate = questionCount >= MINIMUM_QUESTIONS;
  const isDraft = test.status === "DRAFT";
  const canDelete = isAdmin || test.createdBy === user?._id;
  const lockedMeta = { subject: test.title, topic: test.description || test.title };

  const iconButton = (label: string, icon: React.ReactNode, onClick: () => void, variant: "outline" | "secondary" = "outline", testId?: string) => (
    <Button variant={variant} size="sm" onClick={onClick} data-testid={testId}>
      {icon}
      <span className="hidden sm:inline sm:ml-1">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/tests"><Button size="icon" variant="ghost" data-testid="button-back"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title truncate" data-testid="text-test-title">{test.title}</h1>
              <Badge variant={test.status === "ACTIVE" ? "default" : "secondary"}>{test.status}</Badge>
            </div>
            {test.description && <p className="text-muted-foreground text-sm mt-1">{test.description}</p>}
            {test.creatorName && <p className="text-xs text-muted-foreground mt-1">Created by: <span className="font-medium text-foreground">{test.creatorName}</span></p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {iconButton("Download PDF", <Download className="w-4 h-4" />, () => setTemplatePickerOpen(true), "outline", "button-download-pdf")}
          <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1" title="Proctoring warning limit">
            <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Warnings:</span>
            <Input
              type="number"
              min={1}
              max={50}
              className="w-14 h-7 text-xs text-center p-0"
              defaultValue={test.proctorWarningLimit ?? 5}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= 50 && val !== test.proctorWarningLimit) updateTest.mutate({ proctorWarningLimit: val });
              }}
              aria-label="Proctor warning limit"
              data-testid="input-proctor-warning-limit"
            />
          </div>
          {iconButton("Assign", <Users className="w-4 h-4" />, () => { setAssignMode("class"); setAssignOpen(true); }, "secondary", "button-assign-test")}
          {iconButton("Home", <Home className="w-4 h-4" />, () => { setAssignMode("home"); setAssignOpen(true); }, "secondary", "button-assign-home-test")}
          {iconButton("Unassign", <UserMinus className="w-4 h-4" />, () => setManageOpen(true), "outline", "button-manage-assignments")}
          {test.publishRule !== "INSTANT" && iconButton(
            test.resultsPublished ? "Hide results" : "Publish results",
            <FileCheck className="w-4 h-4" />,
            () => publishResults.mutate(!test.resultsPublished),
            "outline",
            "button-publish-results"
          )}
          {isAdmin && iconButton("Share", <Share2 className="w-4 h-4" />, () => setShareOpen(true), "outline", "button-share-test")}
          {iconButton("Edit", <Pencil className="w-4 h-4" />, () => {
            setEditForm({
              title: test.title, description: test.description || "", duration: test.duration, maxAttempts: test.maxAttempts,
              publishRule: test.publishRule, startDate: toLocalInput(test.startDate), endDate: toLocalInput(test.endDate),
            });
            setEditInfoOpen(true);
          }, "outline", "button-edit-test-info")}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" size="sm" data-testid="button-delete-test"><Trash2 className="w-4 h-4 text-destructive" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Test</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to delete "{test.title}"? All assignments and attempts will be removed. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteTest.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Clock className="w-5 h-5" />, value: test.duration, label: "Minutes" },
          { icon: <FileCheck className="w-5 h-5" />, value: test.maxAttempts, label: "Max Attempts" },
          { icon: <Eye className="w-5 h-5" />, value: questionCount, label: "Questions" },
          { icon: <Shuffle className="w-5 h-5" />, value: test.randomize ? "Yes" : "No", label: "Randomized" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4 text-center"><div className="text-muted-foreground mx-auto mb-1 w-5">{s.icon}</div><p className="text-lg font-bold text-foreground">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {test.shareToken && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">External Test Link</p>
                <p className="text-xs text-muted-foreground mb-2">Share this link with external students who are not registered in the portal. They sign in with their Student ID.</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block truncate" data-testid="text-share-link">{externalTestLink(test.shareToken)}</code>
              </div>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(externalTestLink(test.shareToken!)); toast({ title: "Link copied to clipboard" }); }} data-testid="button-copy-share-link">
                <Copy className="w-4 h-4 mr-2" />Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isDraft && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {canActivate ? <CheckCircle className="w-4 h-4 text-chart-2" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                <span className="text-sm text-foreground" data-testid="text-question-validation">
                  {questionCount}/{MINIMUM_QUESTIONS} questions added{!canActivate && ` — Minimum ${MINIMUM_QUESTIONS} questions required to activate`}
                </span>
              </div>
              <Button disabled={!canActivate || updateTest.isPending} onClick={() => updateTest.mutate({ status: "ACTIVE" })} data-testid="button-activate-test">
                {updateTest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Activate Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground">Questions ({questionCount})</h2>
        {isDraft && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setBankOpen(true)} data-testid="button-add-from-bank"><BookOpen className="w-4 h-4 mr-2" />Add from Bank</Button>
            <Button onClick={() => { setEditingQuestion(null); setQuestionDialogOpen(true); }} data-testid="button-add-question"><Plus className="w-4 h-4 mr-2" />Add Question</Button>
          </div>
        )}
      </div>

      <QuestionBankPicker
        testId={id}
        open={bankOpen}
        onOpenChange={setBankOpen}
        existingIds={(test.questions || []).map((q) => String(q.questionId))}
        onAdded={(count) => { refresh(); toast({ title: `${count} question(s) added to test` }); }}
      />

      <QuestionFormDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        editing={editingQuestion}
        lockedMeta={lockedMeta}
        pending={saveQuestion.isPending || bulkAdd.isPending}
        onSave={(p) => saveQuestion.mutate(p)}
        onBulkSave={(p) => bulkAdd.mutate(p)}
      />

      {questionCount > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {test.questions.map((tq, idx) => {
              const q = tq.question;
              return (
                <div key={q._id} className="py-3 px-3 rounded-md bg-muted/30" data-testid={`question-row-${q._id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground font-mono text-xs shrink-0">Q{String(idx + 1).padStart(2, "0")}</span>
                        <Badge variant="secondary" className="text-[10px]">{q.marks} marks</Badge>
                        {q.negativeMarks > 0 && <span className="text-xs text-destructive">-{q.negativeMarks}</span>}
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">{q.questionText}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-xs px-2.5 py-1.5 rounded-md ${i === q.correctAnswer ? "bg-chart-2/10 text-chart-2 font-medium" : "bg-muted/50 text-muted-foreground"}`}>{String.fromCharCode(65 + i)}. {opt}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingQuestion(q); setQuestionDialogOpen(true); }} data-testid={`button-edit-question-${q._id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                      {isDraft && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" data-testid={`button-remove-question-${q._id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Remove Question</AlertDialogTitle><AlertDialogDescription>Remove this question from the test? It stays in the question bank.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removeQuestion.mutate(q._id)}>Remove</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-12 text-center"><Plus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No questions added yet</p><p className="text-muted-foreground/70 text-xs mt-1">Click "Add Question" to start building your test</p></CardContent></Card>
      )}

      {attempts && attempts.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Student Attempts ({attempts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {attempts.map((a) => {
              const pct = pctOf(a.score, a.totalMarks);
              const row = (
                <div className={`flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/30 ${a.submittedAt ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`} data-testid={`attempt-row-${a._id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.student?.name}</p>
                    <p className="text-xs text-muted-foreground">{a.submittedAt ? `Submitted ${new Date(a.submittedAt).toLocaleDateString()}` : "In progress"}</p>
                  </div>
                  {a.submittedAt && (
                    <div className="text-right flex items-center gap-2">
                      <div><p className="text-sm font-bold text-foreground">{a.score}/{a.totalMarks}</p><Badge variant={scoreVariant(pct)} className="text-[10px]">{pct}%</Badge></div>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
              return a.submittedAt ? <Link key={a._id} href={`/results/${a._id}`}>{row}</Link> : <div key={a._id}>{row}</div>;
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Test Details</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (editForm.publishRule === "SCHEDULED" && !editForm.endDate) {
              toast({ title: "Error", description: "A scheduled test needs a closing time", variant: "destructive" });
              return;
            }
            updateTest.mutate({ ...editForm, startDate: fromLocalInput(editForm.startDate), endDate: fromLocalInput(editForm.endDate) });
          }}>
            <div className="space-y-2"><Label>Subject Name</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required data-testid="input-edit-title" /></div>
            <div className="space-y-2"><Label>Topic Name</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} required data-testid="input-edit-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min={1} value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })} data-testid="input-edit-duration" /></div>
              <div className="space-y-2"><Label>Max Attempts</Label><Input type="number" min={1} value={editForm.maxAttempts} onChange={(e) => setEditForm({ ...editForm, maxAttempts: Number(e.target.value) })} data-testid="input-edit-max-attempts" /></div>
            </div>
            <div className="space-y-2">
              <Label>Result Publish Type</Label>
              <Select value={editForm.publishRule} onValueChange={(v) => setEditForm({ ...editForm, publishRule: v as PublishRule })}>
                <SelectTrigger data-testid="select-edit-publish-rule"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INSTANT">Instant</SelectItem><SelectItem value="MANUAL">Manual</SelectItem><SelectItem value="SCHEDULED">Scheduled</SelectItem></SelectContent>
              </Select>
            </div>
            <TestWindowFields
              idPrefix="edit"
              startDate={editForm.startDate}
              endDate={editForm.endDate}
              publishRule={editForm.publishRule}
              onChange={(v) => setEditForm({ ...editForm, ...v })}
            />
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={updateTest.isPending} data-testid="button-submit-edit-info">{updateTest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Download PDF</DialogTitle><DialogDescription>Choose a template for your test PDF background, or download without one.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => handleDownloadPDF(null)} disabled={downloading} data-testid="button-download-no-template">
              <div className="w-10 h-14 rounded border border-border bg-white flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-muted-foreground" /></div>
              <div className="text-left"><p className="font-medium text-sm">No Template</p><p className="text-xs text-muted-foreground">Plain white background</p></div>
            </Button>
            {templates.map((t) => (
              <Button key={t._id} variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => handleDownloadPDF(t._id)} disabled={downloading} data-testid={`button-download-template-${t._id}`}>
                <div className="w-10 h-14 rounded border border-border bg-primary/5 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                <div className="text-left"><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-muted-foreground">Added {new Date(t.createdAt).toLocaleDateString()}</p></div>
                {downloading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
            ))}
            {templates.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No templates uploaded yet. Add templates under MCQ Settings.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <AssignStudentsDialog testId={id} open={assignOpen} onOpenChange={setAssignOpen} mode={assignMode} />
      <ManageAssignmentsDialog testId={id} open={manageOpen} onOpenChange={setManageOpen} />
      {isAdmin && <ShareTestDialog testId={id} open={shareOpen} onOpenChange={setShareOpen} creatorId={test.createdBy} />}
    </div>
  );
}
