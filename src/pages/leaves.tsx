import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { CalendarOff, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";

const statusStyles: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-chart-4/10 text-chart-4", label: "Pending" },
  approved: { className: "bg-chart-2/10 text-chart-2", label: "Approved" },
  rejected: { className: "bg-destructive/10 text-destructive", label: "Rejected" },
};

const leaveTypeLabels: Record<string, string> = {
  sick: "Sick Leave",
  casual: "Casual Leave",
  personal: "Personal Leave",
  vacation: "Vacation",
  other: "Other",
};

export default function LeavesPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const isAdmin = ["org_admin", "teacher", "manager"].includes(user?.role || "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
    isHalfDay: false,
    halfDayPeriod: "morning" as "morning" | "afternoon",
  });

  const { data: myLeaves, isLoading: myLoading } = useQuery({
    queryKey: ["/api/leaves/my"],
    queryFn: async () => {
      const res = await fetch("/api/leaves/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: orgLeaves, isLoading: orgLoading } = useQuery({
    queryKey: ["/api/leaves/org"],
    queryFn: async () => {
      const res = await fetch("/api/leaves/org", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: leaveStats } = useQuery({
    queryKey: ["/api/leaves/stats"],
    queryFn: async () => {
      const res = await fetch("/api/leaves/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createLeave = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaves/stats"] });
      setOpen(false);
      setForm({ leaveType: "casual", startDate: "", endDate: "", reason: "", isHalfDay: false, halfDayPeriod: "morning" });
      toast({ title: "Leave request submitted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approveLeave = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/leaves/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/org"] });
      toast({ title: "Leave request updated" });
    },
  });

  const renderLeaveCard = (leave: any, showActions: boolean) => {
    const ss = statusStyles[leave.status] || statusStyles.pending;
    return (
      <div key={leave._id} className="p-4 rounded-md border border-border/50 space-y-3" data-testid={`card-leave-${leave._id}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            {leave.userId && typeof leave.userId === "object" && (
              <p className="font-medium text-sm">{leave.userId.firstName} {leave.userId.lastName}</p>
            )}
            <p className="text-sm font-medium">{leaveTypeLabels[leave.leaveType]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
              {leave.isHalfDay && <span className="ml-2 text-chart-5">(Half-day: {leave.halfDayPeriod})</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-md shrink-0 ${ss.className}`}>{ss.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{leave.reason}</p>
        {showActions && leave.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="text-chart-2"
              onClick={() => approveLeave.mutate({ id: leave._id, status: "approved" })}
              data-testid={`button-approve-leave-${leave._id}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-destructive"
              onClick={() => approveLeave.mutate({ id: leave._id, status: "rejected" })}
              data-testid={`button-reject-leave-${leave._id}`}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-leaves-title">Leave Requests</h1>
          <p className="text-muted-foreground">Manage leave requests and balances</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-request-leave">
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createLeave.mutate(form); }} className="space-y-4">
              <div>
                <Label>Leave Type</Label>
                <Select value={form.leaveType} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" data-testid="input-leave-start" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
                <div><Label>End Date</Label><Input type="date" data-testid="input-leave-end" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div>
                  <p className="text-sm font-medium">Half-Day Leave</p>
                  <p className="text-xs text-muted-foreground">Request only half a day off</p>
                </div>
                <Switch
                  checked={form.isHalfDay}
                  onCheckedChange={(v) => setForm({ ...form, isHalfDay: v })}
                  data-testid="switch-half-day"
                />
              </div>
              {form.isHalfDay && (
                <div>
                  <Label>Half-Day Period</Label>
                  <Select value={form.halfDayPeriod} onValueChange={(v) => setForm({ ...form, halfDayPeriod: v as "morning" | "afternoon" })}>
                    <SelectTrigger data-testid="select-half-day-period"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Reason</Label>
                <Textarea data-testid="input-leave-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required className="resize-none" rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={createLeave.isPending} data-testid="button-submit-leave">
                {createLeave.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{leaveStats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{leaveStats?.approved || 0}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{leaveStats?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{leaveStats?.rejected || 0}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={isAdmin ? "team" : "my"}>
        <TabsList>
          <TabsTrigger value="my" data-testid="tab-my-leaves">My Leaves</TabsTrigger>
          {isAdmin && <TabsTrigger value="team" data-testid="tab-team-leaves">Team Leaves</TabsTrigger>}
        </TabsList>

        <TabsContent value="my">
          {myLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (myLeaves || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarOff className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No leave requests yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(myLeaves || []).map((l: any) => renderLeaveCard(l, false))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team">
            {orgLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (orgLeaves || []).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarOff className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No team leave requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(orgLeaves || []).map((l: any) => renderLeaveCard(l, true))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
