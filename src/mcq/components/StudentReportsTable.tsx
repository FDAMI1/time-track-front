import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, FileText, Eye } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { useDownload } from "@/mcq/lib/useDownload";
import type { McqStudentPerformance } from "@/mcq/lib/types";
import PeriodSelect, { periodLabels, type Period } from "./PeriodSelect";

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  extended?: boolean;
  onView?: (studentId: string) => void;
  title?: string;
}

export function useStudentPerformance(period: Period) {
  const api = useMcqApi();
  return useQuery({
    queryKey: ["/api/mcq/dashboard/students", period],
    queryFn: () => api.get<McqStudentPerformance[]>(`/api/mcq/dashboard/students?period=${period}`),
  });
}

// Per-student performance table with Excel/Word downloads. `extended` adds
// the assigned/submitted columns and a view button (analytics page).
export default function StudentReportsTable({ period, onPeriodChange, extended, onView, title = "Student Reports" }: Props) {
  const { data: students, isLoading } = useStudentPerformance(period);
  const { downloading, download } = useDownload();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={downloading === "all-excel"}
              onClick={() => download(`/api/mcq/dashboard/students/download/all-excel?period=${period}`, "all-excel")}
              data-testid="button-download-all-excel"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading === "all-excel" ? "Downloading..." : "Export All"}
            </Button>
            <PeriodSelect value={period} onChange={onPeriodChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : students && students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Student</th>
                  {extended && <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Assigned</th>}
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Attempts</th>
                  {extended && <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Submitted</th>}
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Score / Total</th>
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Avg %</th>
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const pct = Math.round(s.avgScore || 0);
                  return (
                    <tr key={s.studentId} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`report-row-${s.studentId}`}>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-foreground">{s.studentName}</p>
                        <p className="text-xs text-muted-foreground">{s.studentEmail}</p>
                      </td>
                      {extended && <td className="text-center py-2.5 px-3">{s.totalAssigned}</td>}
                      <td className="text-center py-2.5 px-3 font-medium">{s.totalAttempts}</td>
                      {extended && <td className="text-center py-2.5 px-3">{s.submitted}</td>}
                      <td className="text-center py-2.5 px-3">
                        <span className="font-medium">{s.totalScore}</span>
                        <span className="text-muted-foreground"> / {s.totalMarks}</span>
                      </td>
                      <td className="text-center py-2.5 px-3">
                        {s.totalAttempts > 0 ? (
                          <Badge variant={pct >= 80 ? "default" : pct >= 60 ? "secondary" : "destructive"}>{pct}%</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {onView && (
                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onView(s.studentId)} title="View Details" data-testid={`button-view-student-${s.studentId}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={downloading === `excel-${s.studentId}`}
                            onClick={() => download(`/api/mcq/dashboard/students/${s.studentId}/download/excel?period=${period}`, `excel-${s.studentId}`)}
                            title="Download Excel"
                            data-testid={`button-excel-${s.studentId}`}
                          >
                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={downloading === `word-${s.studentId}`}
                            onClick={() => download(`/api/mcq/dashboard/students/${s.studentId}/download/word?period=${period}`, `word-${s.studentId}`)}
                            title="Download Word"
                            data-testid={`button-word-${s.studentId}`}
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-6">No student data for {periodLabels[period].toLowerCase()}</p>
        )}
      </CardContent>
    </Card>
  );
}
