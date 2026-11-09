import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, ExternalLink, Trash2, ChevronLeft, ChevronRight, Calendar, Users, Trophy, Target, AlertTriangle, Download } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqExternalAttempt } from "@/mcq/lib/types";
import ExternalStudentsPanel from "@/mcq/components/ExternalStudentsPanel";
import { useClampPage } from "@/mcq/lib/usePagination";

interface ListResponse {
  attempts: McqExternalAttempt[];
  total: number;
  totalPages: number;
}

function ExternalAttemptsPanel() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [testName, setTestName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search.trim()) params.set("search", search.trim());
  if (studentId.trim()) params.set("studentId", studentId.trim());
  if (testName.trim()) params.set("testName", testName.trim());
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/external/attempts", search, studentId, testName, startDate, endDate, page],
    queryFn: () => api.get<ListResponse>(`/api/mcq/external/attempts?${params}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/external/attempts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/external/attempts"] }); toast({ title: "Record deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attempts = data?.attempts || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  useClampPage(page, setPage, totalPages, !!data);
  const completed = attempts.filter((a) => a.status === "COMPLETED").length;
  const terminated = attempts.filter((a) => a.status === "TERMINATED").length;
  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.avgPercentage, 0) / attempts.length) : 0;
  const hasFilters = !!(search || studentId || testName || startDate || endDate);

  const setFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(e.target.value); setPage(1); };
  const clearFilters = () => { setSearch(""); setStudentId(""); setTestName(""); setStartDate(""); setEndDate(""); setPage(1); };

  const exportExcel = () => {
    if (!attempts.length) return;
    const rows = attempts.map((a) => ({
      "Student Name": a.studentName,
      "Student ID": a.studentId,
      "Test Name": a.testTitle,
      Score: `${a.score}/${a.totalMarks}`,
      Percentage: `${a.avgPercentage}%`,
      Warnings: a.warningCount,
      Status: a.status,
      "Submitted At": new Date(a.submittedAt).toLocaleString(),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "External Results");
    XLSX.writeFile(wb, "external_results.xlsx");
  };

  const stat = (icon: React.ReactNode, value: string | number, label: string, testId: string) => (
    <Card><CardContent className="p-4 text-center"><div className="w-5 h-5 text-muted-foreground mx-auto mb-1">{icon}</div><p className="text-lg font-bold text-foreground" data-testid={testId}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{total} external test attempt(s)</p>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!attempts.length} data-testid="button-export-excel"><Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Export Excel</span></Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stat(<Users className="w-5 h-5" />, total, "Total Attempts", "text-total-attempts")}
        {stat(<Trophy className="w-5 h-5" />, completed, "Completed", "text-completed-count")}
        {stat(<AlertTriangle className="w-5 h-5" />, terminated, "Terminated", "text-terminated-count")}
        {stat(<Target className="w-5 h-5" />, `${avg}%`, "Avg Score", "text-avg-score")}
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search name, ID, or test..." value={search} onChange={setFilter(setSearch)} className="pl-9" data-testid="input-search" /></div>
          <Input placeholder="Filter by Student ID" value={studentId} onChange={setFilter(setStudentId)} data-testid="input-filter-student-id" />
          <Input placeholder="Filter by Test Name" value={testName} onChange={setFilter(setTestName)} data-testid="input-filter-test-name" />
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground shrink-0" /><Input type="date" value={startDate} onChange={setFilter(setStartDate)} aria-label="Start date" /></div>
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground shrink-0">to</span><Input type="date" value={endDate} onChange={setFilter(setEndDate)} aria-label="End date" />{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-xs">Clear</Button>}</div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : attempts.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><ExternalLink className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{hasFilters ? "No results match your filters" : "No external test attempts yet"}</p></CardContent></Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Student", "Student ID", "Test Name", "Score", "Percentage", "Warnings", "Status", "Date", "Actions"].map((h, i) => <th key={h} className={`py-3 px-4 font-medium text-muted-foreground ${i < 3 ? "text-left" : "text-center"}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a._id} className="border-b hover:bg-muted/50 transition-colors" data-testid={`row-attempt-${a._id}`}>
                    <td className="py-3 px-4 font-medium text-foreground">{a.studentName}</td>
                    <td className="py-3 px-4"><code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{a.studentId}</code></td>
                    <td className="py-3 px-4">{a.testTitle}</td>
                    <td className="py-3 px-4 text-center font-semibold">{a.score}/{a.totalMarks}</td>
                    <td className="py-3 px-4 text-center"><Badge variant="secondary" className={a.avgPercentage >= 70 ? "bg-chart-2/10 text-chart-2" : a.avgPercentage >= 40 ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive"}>{a.avgPercentage}%</Badge></td>
                    <td className="py-3 px-4 text-center">{a.warningCount > 0 ? <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">{a.warningCount}</Badge> : <span className="text-muted-foreground text-xs">0</span>}</td>
                    <td className="py-3 px-4 text-center"><Badge variant="secondary" className={a.status === "COMPLETED" ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}>{a.status === "COMPLETED" ? "Completed" : "Terminated"}</Badge></td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-xs text-muted-foreground">{new Date(a.submittedAt).toLocaleDateString()}<br /><span className="text-[11px]">{new Date(a.submittedAt).toLocaleTimeString()}</span></td>
                    <td className="py-3 px-4 text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" data-testid={`button-delete-${a._id}`}><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Record</AlertDialogTitle><AlertDialogDescription>Delete the attempt record for {a.studentName} on "{a.testTitle}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate(a._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} records)</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function McqExternalResultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title" data-testid="text-page-title">External Tests</h1>
        <p className="text-muted-foreground text-sm mt-1">Results from students who took tests through a public share link, and the external student roster.</p>
      </div>
      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") === "students" ? "students" : "results"}>
        <TabsList>
          <TabsTrigger value="results" data-testid="tab-external-results">Results</TabsTrigger>
          <TabsTrigger value="students" data-testid="tab-external-students">External Students</TabsTrigger>
        </TabsList>
        <TabsContent value="results" className="mt-4"><ExternalAttemptsPanel /></TabsContent>
        <TabsContent value="students" className="mt-4"><ExternalStudentsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
