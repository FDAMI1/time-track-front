import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Home, Camera, Loader2, UserMinus, Share2, X } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { MCQ_TAKER_ROLES, isMcqAdmin } from "@/mcq/lib/roles";
import { userName, type McqAssignment, type McqShare, type OrgUser } from "@/mcq/lib/types";

// Existing app endpoint: returns the organization's users (teachers only see
// the students assigned to them).
export function useOrgUsers(enabled = true) {
  return useQuery<OrgUser[]>({ queryKey: ["/api/users"], enabled });
}

function invalidateTest(testId: string) {
  queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] });
  queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests", testId] });
}

interface BaseProps {
  testId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignStudentsDialog({ testId, open, onOpenChange, mode }: BaseProps & { mode: "class" | "home" }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const { data: users } = useOrgUsers(open);
  const students = (users || []).filter((u) => MCQ_TAKER_ROLES.includes(u.role) && u.isActive);

  const assign = useMutation({
    mutationFn: () => api.post<{ message?: string }>(`/api/mcq/tests/${testId}/assign`, { studentIds: selected, allowHomeTest: mode === "home" }),
    onSuccess: (result) => {
      if (testId) invalidateTest(testId);
      setSelected([]);
      onOpenChange(false);
      toast({
        title: mode === "home" ? "Students assigned for home test" : "Students assigned for class test",
        description: result?.message || (mode === "home" ? "Camera monitoring will be enabled for these students." : undefined),
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected([]); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "home" ? <><Home className="w-5 h-5 text-primary" />Assign to Home</> : <><Users className="w-5 h-5" />Assign for Class</>}
          </DialogTitle>
          <DialogDescription>
            {mode === "home" ? "Select students to assign this test for home with camera monitoring." : "Select students to assign this test for classroom."}
          </DialogDescription>
        </DialogHeader>
        {mode === "home" && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex items-start gap-2">
            <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Students assigned to home will be required to enable their camera and share their screen during the test. Face detection monitoring stays active throughout.
            </p>
          </div>
        )}
        {!users ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : students.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No students available</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{selected.length} student(s) selected</Label>
              <Button variant="ghost" size="sm" onClick={() => setSelected(selected.length === students.length ? [] : students.map((s) => s._id))} data-testid="button-select-all-students">
                {selected.length === students.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-md p-3">
              {students.map((s) => (
                <label key={s._id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={selected.includes(s._id)} onCheckedChange={() => toggle(s._id)} data-testid={`checkbox-student-${s._id}`} />
                  <span className="text-foreground">{userName(s)}</span>
                  <span className="text-xs text-muted-foreground ml-auto truncate">{s.email}</span>
                </label>
              ))}
            </div>
            <Button className="w-full" disabled={selected.length === 0 || assign.isPending} onClick={() => assign.mutate()} data-testid="button-confirm-assign">
              {assign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "home" ? `Assign to Home (${selected.length})` : `Assign to Class (${selected.length})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ManageAssignmentsDialog({ testId, open, onOpenChange }: BaseProps) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["/api/mcq/tests", testId, "assignments"],
    queryFn: () => api.get<McqAssignment[]>(`/api/mcq/tests/${testId}/assignments`),
    enabled: !!testId && open,
  });

  const unassign = useMutation({
    mutationFn: () => api.post<{ results: { unassigned: boolean }[] }>(`/api/mcq/tests/${testId}/unassign`, { studentIds: selected }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests", testId, "assignments"] });
      if (testId) invalidateTest(testId);
      setSelected([]);
      const failed = data.results.filter((r) => !r.unassigned).length;
      if (failed > 0) {
        toast({ title: "Some students could not be unassigned", description: `${failed} student(s) have already submitted and cannot be removed.`, variant: "destructive" });
      } else {
        toast({ title: "Students unassigned successfully" });
      }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removable = (assignments || []).filter((a) => !a.hasSubmitted).map((a) => a.studentId);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected([]); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserMinus className="w-5 h-5" />Manage Assignments</DialogTitle>
          <DialogDescription>View assigned students and unassign if needed. Students who have already submitted cannot be unassigned.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : !assignments || assignments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No students assigned to this test</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{selected.length} selected for removal</Label>
              <Button variant="ghost" size="sm" onClick={() => setSelected(selected.length === removable.length ? [] : removable)} data-testid="button-select-all-unassign">
                {selected.length === removable.length && removable.length > 0 ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-md p-3">
              {assignments.map((a) => (
                <label key={a._id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={selected.includes(a.studentId)} disabled={a.hasSubmitted} onCheckedChange={() => toggle(a.studentId)} data-testid={`checkbox-unassign-${a.studentId}`} />
                  <span className="text-foreground">{a.studentName}</span>
                  {a.allowHomeTest && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Home className="w-2.5 h-2.5 mr-0.5" />Home</Badge>}
                  {a.hasSubmitted && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Submitted</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto truncate">{a.studentEmail}</span>
                </label>
              ))}
            </div>
            <Button className="w-full" variant="destructive" disabled={selected.length === 0 || unassign.isPending} onClick={() => unassign.mutate()} data-testid="button-confirm-unassign">
              {unassign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <UserMinus className="w-4 h-4 mr-2" />
              Unassign ({selected.length})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShareTestDialog({ testId, open, onOpenChange, creatorId }: BaseProps & { creatorId?: string }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const [teacherId, setTeacherId] = useState<string>("");
  const { data: users } = useOrgUsers(open && isMcqAdmin(user?.role));

  const { data: shares } = useQuery({
    queryKey: ["/api/mcq/tests", testId, "shares"],
    queryFn: () => api.get<McqShare[]>(`/api/mcq/tests/${testId}/shares`),
    enabled: !!testId && open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests", testId, "shares"] });
    queryClient.invalidateQueries({ queryKey: ["/api/mcq/tests"] });
  };

  const share = useMutation({
    mutationFn: () => api.post(`/api/mcq/tests/${testId}/share`, { teacherId }),
    onSuccess: () => { refresh(); setTeacherId(""); toast({ title: "Test shared successfully" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const unshare = useMutation({
    mutationFn: (id: string) => api.post(`/api/mcq/tests/${testId}/unshare`, { teacherId: id }),
    onSuccess: () => { refresh(); toast({ title: "Teacher removed from shared list" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sharedIds = new Set((shares || []).map((s) => s.teacherId));
  const teachers = (users || []).filter((u) => ["teacher", "manager"].includes(u.role) && u.isActive && u._id !== creatorId && !sharedIds.has(u._id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="w-5 h-5" />Share Test with Teacher</DialogTitle>
          <DialogDescription>Share this test with another teacher. The original creator remains unchanged, and the shared teacher can view and manage the test.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Teacher</Label>
            <div className="flex gap-2">
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger data-testid="select-share-teacher"><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t._id} value={t._id}>{userName(t)} ({t.email})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button disabled={!teacherId || share.isPending} onClick={() => share.mutate()} data-testid="button-confirm-share">
                {share.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              </Button>
            </div>
            {teachers.length === 0 && <p className="text-xs text-muted-foreground">No more teachers available to share with.</p>}
          </div>
          {shares && shares.length > 0 && (
            <div className="space-y-2">
              <Label>Currently Shared With</Label>
              {shares.map((s) => (
                <div key={s._id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium" data-testid={`text-shared-teacher-${s.teacherId}`}>{s.teacherName}</p>
                    <p className="text-xs text-muted-foreground">{s.teacherEmail}</p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={unshare.isPending} onClick={() => unshare.mutate(s.teacherId)} data-testid={`button-unshare-${s.teacherId}`}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
