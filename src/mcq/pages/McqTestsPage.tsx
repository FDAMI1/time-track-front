import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, ClipboardList, Loader2, Users, Clock, FileCheck, Eye, Trash2, Home, Filter, LinkIcon, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { isMcqAdmin } from "@/mcq/lib/roles";
import { userName, type McqTest, type OrgUser, type PublishRule, type TestStatus } from "@/mcq/lib/types";
import { AssignStudentsDialog, useOrgUsers } from "@/mcq/components/TestAssignDialogs";
import { useClampPage } from "@/mcq/lib/usePagination";
import TestWindowFields, { fromLocalInput } from "@/mcq/components/TestWindowFields";

const PAGE_SIZE = 20;

const statusVariant = (status: TestStatus): "default" | "secondary" | "destructive" =>
  status === "ACTIVE" ? "default" : status === "EXPIRED" ? "destructive" : "secondary";

export function externalTestLink(shareToken: string) {
  return `${window.location.origin}/mcq/external-test/${shareToken}`;
}

export default function McqTestsPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isAdmin = isMcqAdmin(user?.role);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"class" | "home">("class");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: "", description: "", duration: 30, maxAttempts: 1, publishRule: "INSTANT" as PublishRule, startDate: "", endDate: "" });

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (teacherFilter !== "all") params.set("teacherFilter", teacherFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/tests", page, teacherFilter],
    queryFn: () => api.get<{ tests: McqTest[]; total: number }>(`/api/mcq/tests?${params}`),
  });
  const { data: users } = useOrgUsers(isAdmin);
  const teachers = (users || []).filter((u: OrgUser) => ["teacher", "manager"].includes(u.role));

  const create = useMutation({
    mutationFn: () => {
      if (form.publishRule === "SCHEDULED" && !form.endDate) throw new Error("A scheduled test needs a closing time");
      return api.post<McqTest>("/api/mcq/tests", { ...form, startDate: fromLocalInput(form.startDate), endDate: fromLocalInput(form.endDate) });
    },
    onSuccess: (test) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] });
      setCreateOpen(false);
      setForm({ title: "", description: "", duration: 30, maxAttempts: 1, publishRule: "INSTANT", startDate: "", endDate: "" });
      toast({ title: "Test created as Draft" });
      navigate(`/tests/${test._id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/tests/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] }); toast({ title: "Test deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openAssign = (testId: string, mode: "class" | "home") => {
    setSelectedTestId(testId);
    setAssignMode(mode);
    setAssignOpen(true);
  };

  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useClampPage(page, setPage, totalPages, !!data);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tests</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} tests total</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && teachers.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]" data-testid="select-teacher-filter"><SelectValue placeholder="Filter by teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {teachers.map((t) => <SelectItem key={t._id} value={t._id}>{userName(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-test"><Plus className="w-4 h-4 mr-2" />Create Test</Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Test</DialogTitle>
            <DialogDescription>Step 1: Enter basic test information. You will add questions in the next step.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="space-y-2">
              <Label>Subject Name</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mathematics" required data-testid="input-test-title" />
            </div>
            <div className="space-y-2">
              <Label>Topic Name</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Algebra - Chapter 5" required data-testid="input-test-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" min={1} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} required data-testid="input-test-duration" />
              </div>
              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input type="number" min={1} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} required data-testid="input-test-max-attempts" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Result Publish Type</Label>
              <Select value={form.publishRule} onValueChange={(v) => setForm({ ...form, publishRule: v as PublishRule })}>
                <SelectTrigger data-testid="select-publish-rule"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTANT">Instant</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TestWindowFields
              idPrefix="create"
              startDate={form.startDate}
              endDate={form.endDate}
              publishRule={form.publishRule}
              onChange={(v) => setForm({ ...form, ...v })}
            />
            <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-test">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save & Add Questions
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AssignStudentsDialog testId={selectedTestId} open={assignOpen} onOpenChange={setAssignOpen} mode={assignMode} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : data && data.tests.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.tests.map((test) => (
              <Card key={test._id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate" data-testid={`text-test-title-${test._id}`}>{test.title}</h3>
                      {test.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{test.description}</p>}
                      {test.creatorName && <p className="text-xs text-muted-foreground mt-1">Created by: <span className="font-medium text-foreground">{test.creatorName}</span></p>}
                    </div>
                    <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{test.duration} min</span>
                    <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />{test.maxAttempts} attempt(s)</span>
                    <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" />{test.questionCount || 0} questions</span>
                    <span className="flex items-center gap-1" data-testid={`text-assigned-count-${test._id}`}><Users className="w-3 h-3" />{test.assignedCount || 0} assigned</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/tests/${test._id}`}><Button size="sm" variant="secondary" data-testid={`button-view-test-${test._id}`}><Eye className="w-3 h-3 mr-1" />View</Button></Link>
                    <Button size="sm" variant="secondary" onClick={() => openAssign(test._id, "class")} data-testid={`button-assign-test-${test._id}`}><Users className="w-3 h-3 mr-1" />Assign</Button>
                    <Button size="sm" variant="secondary" onClick={() => openAssign(test._id, "home")} data-testid={`button-home-assign-test-${test._id}`}><Home className="w-3 h-3 mr-1" />Home</Button>
                    {test.shareToken && (
                      <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(externalTestLink(test.shareToken!)); toast({ title: "Test link copied to clipboard" }); }} data-testid={`button-copy-link-${test._id}`}>
                        <LinkIcon className="w-3 h-3 mr-1" />Link
                      </Button>
                    )}
                    {(isAdmin || test.createdBy === user?._id) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" data-testid={`button-delete-test-${test._id}`}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Test</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to delete "{test.title}"? All assignments and attempts for this test will be removed. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(test._id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card><CardContent className="p-12 text-center"><ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No tests found</p></CardContent></Card>
      )}
    </div>
  );
}
