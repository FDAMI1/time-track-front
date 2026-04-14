import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, CheckCheck, ExternalLink, Phone, User, Calendar, SendHorizonal, Trash2, Filter } from "lucide-react";

function formatWhatsappLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^+\d]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

const statusColors: Record<string, string> = {
  present: "bg-chart-2/10 text-chart-2",
  late: "bg-chart-4/10 text-chart-4",
  absent: "bg-destructive/10 text-destructive",
  pending: "bg-chart-3/10 text-chart-3",
};

export default function WhatsappNotificationsPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const buildQuery = () => {
    const params = new URLSearchParams({ limit: "200" });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  };

  const queryKey = ["/api/whatsapp/notifications", startDate, endDate];

  const { data: notifications, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/notifications?${buildQuery()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markSent = useMutation({
    mutationFn: async ({ id, sentToStudent, sentToParent }: { id: string; sentToStudent?: boolean; sentToParent?: boolean }) => {
      const res = await fetch(`/api/whatsapp/notifications/${id}/mark-sent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sentToStudent, sentToParent }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/whatsapp/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: (result) => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey });
      toast({ title: `Deleted ${result.deleted} notification(s)` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete selected notifications", variant: "destructive" });
    },
  });

  const list: any[] = notifications || [];

  const hasNumbers = (n: any) => n.studentWhatsapp || n.parentWhatsapp;
  const isSent = (n: any) => {
    if (!hasNumbers(n)) return true;
    const studentDone = !n.studentWhatsapp || n.sentToStudent;
    const parentDone = !n.parentWhatsapp || n.sentToParent;
    return studentDone && parentDone;
  };
  const pending = list.filter((n) => hasNumbers(n) && !isSent(n));
  const sent = list.filter((n) => isSent(n));

  const allSelected = list.length > 0 && selectedIds.size === list.length;
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((n) => n._id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function sendAllPending() {
    const pendingNotifications = list.filter((n) => hasNumbers(n) && !isSent(n));
    if (pendingNotifications.length === 0) return;
    const links: string[] = [];
    for (const n of pendingNotifications) {
      if (n.studentWhatsapp && !n.sentToStudent) links.push(formatWhatsappLink(n.studentWhatsapp, n.message));
      if (n.parentWhatsapp && !n.sentToParent) links.push(formatWhatsappLink(n.parentWhatsapp, n.message));
    }
    let opened = 0;
    for (const link of links) {
      const win = window.open(link, "_blank", "noopener,noreferrer");
      if (win) opened++;
    }
    if (opened === 0 && links.length > 0) {
      toast({ title: "Popups blocked", description: "Please allow popups for this site to send all messages at once", variant: "destructive" });
      return;
    }
    for (const n of pendingNotifications) {
      markSent.mutate({ id: n._id, sentToStudent: !n.sentToStudent ? true : undefined, sentToParent: !n.sentToParent ? true : undefined });
    }
    toast({ title: "Opening WhatsApp", description: opened < links.length ? `Opened ${opened}/${links.length} messages. Some popups may have been blocked.` : `Opening ${links.length} message(s) in WhatsApp` });
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-whatsapp-title">
          <MessageCircle className="w-6 h-6 text-green-600" />
          WhatsApp Notifications
        </h1>
        <p className="text-muted-foreground">Attendance notifications sent to students and parents via WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <MessageCircle className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold" data-testid="text-total-notifications">{list.length}</p>
            <p className="text-xs text-muted-foreground">Total Notifications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="w-6 h-6 text-chart-3 mx-auto mb-1" />
            <p className="text-2xl font-bold text-chart-3" data-testid="text-pending-notifications">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pending to Send</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCheck className="w-6 h-6 text-chart-2 mx-auto mb-1" />
            <p className="text-2xl font-bold text-chart-2" data-testid="text-sent-notifications">{sent.length}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Date range filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Filter className="w-4 h-4 text-muted-foreground mb-2" />
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setSelectedIds(new Set()); }}
                className="h-8 w-40 text-sm"
                data-testid="input-filter-start-date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setSelectedIds(new Set()); }}
                className="h-8 w-40 text-sm"
                data-testid="input-filter-end-date"
              />
            </div>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStartDate(""); setEndDate(""); setSelectedIds(new Set()); }} data-testid="button-clear-filter">
                Clear filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && !isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{pending.length} pending notification(s)</p>
                <p className="text-xs text-muted-foreground">Open all pending messages in WhatsApp at once</p>
              </div>
              <Button onClick={sendAllPending} className="bg-green-600 hover:bg-green-700 text-white" disabled={markSent.isPending} data-testid="button-send-all-bulk">
                <SendHorizonal className="w-4 h-4 mr-2" />
                Send All ({pending.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {startDate || endDate ? "No results for selected date range" : "Notifications will appear here when attendance is marked"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Bulk action bar */}
          <div className="flex items-center gap-3 px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
            </span>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  if (confirm(`Delete ${selectedIds.size} selected notification(s)? This cannot be undone.`)) {
                    bulkDelete.mutate(Array.from(selectedIds));
                  }
                }}
                disabled={bulkDelete.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          {list.map((n: any) => (
            <Card key={n._id} data-testid={`card-notification-${n._id}`} className={!isSent(n) ? "border-green-200 dark:border-green-800" : ""}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex items-start pt-1">
                    <Checkbox
                      checked={selectedIds.has(n._id)}
                      onCheckedChange={() => toggleOne(n._id)}
                      data-testid={`checkbox-notification-${n._id}`}
                    />
                  </div>
                  <div className="flex-1 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{n.studentName}</span>
                        <Badge className={statusColors[n.attendanceStatus] || "bg-muted text-muted-foreground"}>
                          {n.attendanceStatus.charAt(0).toUpperCase() + n.attendanceStatus.slice(1)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {n.date} at {n.time}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mt-2">
                        {n.studentWhatsapp && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Student:</span>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">{n.studentWhatsapp}</span>
                            {n.sentToStudent ? (
                              <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 text-[10px] px-1.5 py-0">
                                <CheckCheck className="w-3 h-3 mr-0.5" /> Sent
                              </Badge>
                            ) : (
                              <a href={formatWhatsappLink(n.studentWhatsapp, n.message)} target="_blank" rel="noopener noreferrer" onClick={() => markSent.mutate({ id: n._id, sentToStudent: true })} data-testid={`link-send-student-${n._id}`}>
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Send
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                        {n.parentWhatsapp && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Parent:</span>
                            <span className="text-xs font-medium">{n.parentWhatsapp}</span>
                            {n.sentToParent ? (
                              <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 text-[10px] px-1.5 py-0">
                                <CheckCheck className="w-3 h-3 mr-0.5" /> Sent
                              </Badge>
                            ) : (
                              <a href={formatWhatsappLink(n.parentWhatsapp, n.message)} target="_blank" rel="noopener noreferrer" onClick={() => markSent.mutate({ id: n._id, sentToParent: true })} data-testid={`link-send-parent-${n._id}`}>
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Send
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {!hasNumbers(n) && (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground self-start lg:self-center">
                        <Phone className="w-3.5 h-3.5 mr-1" />
                        No WhatsApp Numbers
                      </Badge>
                    )}

                    {hasNumbers(n) && !isSent(n) && n.studentWhatsapp && n.parentWhatsapp && (
                      <div className="flex gap-2">
                        <a href={formatWhatsappLink(n.studentWhatsapp, n.message)} target="_blank" rel="noopener noreferrer" onClick={() => markSent.mutate({ id: n._id, sentToStudent: true, sentToParent: false })}>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" data-testid={`button-send-all-${n._id}`}>
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Open WhatsApp
                          </Button>
                        </a>
                      </div>
                    )}

                    {hasNumbers(n) && isSent(n) && (
                      <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 self-start lg:self-center">
                        <CheckCheck className="w-3.5 h-3.5 mr-1" />
                        All Sent
                      </Badge>
                    )}
                  </div>
                </div>

                <details className="mt-2 ml-7">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View Message</summary>
                  <pre className="mt-2 text-xs bg-muted/50 p-3 rounded-md whitespace-pre-wrap">{n.message}</pre>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
