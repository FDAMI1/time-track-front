import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { localDateString } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Project { _id: string; projectName: string }

const minutesBetween = (start: string, end: string, overnight: boolean) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0 && overnight) mins += 1440;
  return mins;
};

const EMPTY = { date: "", startTime: "", endTime: "", overnight: false, taskName: "", description: "", category: "", projectId: "" };

// Time worked without the timer. It waits for a manager's approval before it counts.
export default function ManualEntryDialog({ open, onOpenChange, needsApproval, coords }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  needsApproval: boolean;
  coords?: () => Promise<{ latitude: number; longitude: number } | null>;
}) {
  const api = useMcqApi();
  const { toast } = useToast();
  const today = localDateString();
  const [form, setForm] = useState({ ...EMPTY, date: today });
  // Projects are optional; people without access simply don't get the list.
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects", "for-time"],
    queryFn: () => api.get<Project[]>("/api/projects").catch(() => [] as Project[]),
    enabled: open,
  });

  const minutes = minutesBetween(form.startTime, form.endTime, form.overnight);
  const save = useMutation({
    mutationFn: async () => {
      const location = coords ? await coords() : null;
      return api.post("/api/timetracking", {
        ...form, taskName: form.taskName.trim(), projectId: form.projectId || undefined,
        ...(form.overnight ? {} : { overnight: undefined }),
        ...(location || {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetracking/report"] });
      toast({ title: needsApproval ? "Sent for approval" : "Time entry saved", description: needsApproval ? "It counts toward your hours once your manager approves it." : undefined });
      setForm({ ...EMPTY, date: today });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const valid = form.taskName.trim() && form.date && form.date <= today && minutes > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Manual Entry</DialogTitle>
          <DialogDescription>{needsApproval ? "Your manager approves manual time before it counts toward your hours." : "Your manual time counts at once."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
          <div>
            <Label htmlFor="manual-task">Task name</Label>
            <Input id="manual-task" value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} required maxLength={200} data-testid="input-manual-task" />
          </div>
          <div>
            <Label htmlFor="manual-description">Description</Label>
            <Textarea id="manual-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} rows={2} data-testid="input-manual-description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="manual-date">Work date</Label>
              <Input id="manual-date" type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required data-testid="input-manual-date" />
            </div>
            <div>
              <Label htmlFor="manual-start">Start</Label>
              <Input id="manual-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required data-testid="input-manual-start" />
            </div>
            <div>
              <Label htmlFor="manual-end">End</Label>
              <Input id="manual-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required data-testid="input-manual-end" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.overnight} onCheckedChange={(on) => setForm({ ...form, overnight: !!on })} data-testid="checkbox-manual-overnight" />
            Ends after midnight
          </label>
          <p className="text-sm" data-testid="text-manual-duration">
            Duration: {minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : <span className="text-destructive">End must be after start</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="manual-category">Work category</Label>
              <Input id="manual-category" placeholder="e.g. Support, Training" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} data-testid="input-manual-category" />
            </div>
            {projects.length > 0 && (
              <div>
                <Label>Project</Label>
                <Select value={form.projectId || "none"} onValueChange={(v) => setForm({ ...form, projectId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-manual-project"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => <SelectItem key={p._id} value={p._id}>{p.projectName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={!valid || save.isPending} data-testid="button-save-manual">
            {save.isPending ? "Saving..." : needsApproval ? "Submit for Approval" : "Save Entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
