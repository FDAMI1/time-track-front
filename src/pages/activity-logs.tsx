import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ChevronLeft, ChevronRight, Filter, Calendar, User } from "lucide-react";

const actionTypes = [
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "attendance_mark", label: "Attendance Mark" },
  { value: "attendance_edit", label: "Attendance Edit" },
  { value: "attendance_approve", label: "Attendance Approve" },
  { value: "leave_request", label: "Leave Request" },
  { value: "leave_approval", label: "Leave Approval" },
  { value: "password_changed", label: "Password Changed" },
  { value: "password_reset", label: "Password Reset" },
  { value: "class_created", label: "Class Created" },
  { value: "class_updated", label: "Class Updated" },
  { value: "class_deleted", label: "Class Deleted" },
  { value: "user_deleted", label: "User Deleted" },
];

const actionBadgeColors: Record<string, string> = {
  login: "bg-chart-2/10 text-chart-2",
  logout: "bg-muted text-muted-foreground",
  attendance_mark: "bg-chart-3/10 text-chart-3",
  attendance_edit: "bg-chart-4/10 text-chart-4",
  attendance_approve: "bg-chart-1/10 text-chart-1",
  leave_request: "bg-chart-5/10 text-chart-5",
  leave_approval: "bg-chart-1/10 text-chart-1",
  password_changed: "bg-chart-4/10 text-chart-4",
  password_reset: "bg-chart-4/10 text-chart-4",
  class_created: "bg-chart-2/10 text-chart-2",
  class_updated: "bg-chart-3/10 text-chart-3",
  class_deleted: "bg-destructive/10 text-destructive",
  user_deleted: "bg-destructive/10 text-destructive",
};

export default function ActivityLogsPage() {
  const { token } = useAuth();
  const [filterAction, setFilterAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filterAction && filterAction !== "all") params.append("action", filterAction);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return params.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ["/api/activity-logs", filterAction, startDate, endDate, page],
    queryFn: async () => {
      const res = await apiFetch(`/api/activity-logs?${buildQueryString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const formatAction = (action: string) => {
    const found = actionTypes.find((a) => a.value === action);
    return found ? found.label : action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserDisplay = (log: any) => {
    if (log.userId && typeof log.userId === "object") {
      return {
        name: `${log.userId.firstName} ${log.userId.lastName}`,
        username: log.userId.username,
        initials: `${log.userId.firstName?.[0] || ""}${log.userId.lastName?.[0] || ""}`,
        role: log.userId.role,
      };
    }
    return { name: "Unknown User", username: "—", initials: "?", role: "" };
  };

  const handleFilterReset = () => {
    setFilterAction("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-activity-logs-title">Activity Logs</h1>
          <p className="text-muted-foreground">View all activity and audit logs</p>
        </div>
        <Badge variant="secondary" data-testid="badge-total-logs">
          {total} total logs
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Action Type
              </Label>
              <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-action">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((a) => (
                    <SelectItem key={a.value} value={a.value} data-testid={`option-action-${a.value}`}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-[160px]"
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-[160px]"
                data-testid="input-end-date"
              />
            </div>

            <Button variant="outline" onClick={handleFilterReset} data-testid="button-reset-filters">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-logs">No activity logs found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date/Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any, index: number) => {
                  const userInfo = getUserDisplay(log);
                  return (
                    <TableRow key={log._id || index} data-testid={`row-log-${log._id || index}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {userInfo.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm" data-testid={`text-log-user-${log._id || index}`}>
                              {userInfo.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{userInfo.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded-md ${actionBadgeColors[log.action] || "bg-muted text-muted-foreground"}`}
                          data-testid={`badge-action-${log._id || index}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground max-w-[300px] truncate" data-testid={`text-log-details-${log._id || index}`}>
                          {log.details || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground" data-testid={`text-log-time-${log._id || index}`}>
                          {formatDateTime(log.timestamp)}
                        </p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
