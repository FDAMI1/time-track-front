import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { LECTURE_STATUSES, peopleOptions, toOptions, type Batch, type Lecture, type Person } from "@/academy/lib/academy";
import { Picker } from "@/academy/components/common";

interface Props {
  lecture: Lecture | null;
  defaultDate: string;
  onClose: () => void;
}

export default function LectureDialog({ lecture, defaultDate, onClose }: Props) {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: lecture?.title || "",
    batchId: lecture?.batchId?._id || "",
    teacherId: lecture?.teacherId?._id || "",
    date: lecture?.date || defaultDate,
    startTime: lecture?.startTime || "",
    endTime: lecture?.endTime || "",
    room: lecture?.room || "",
    status: lecture?.status || "scheduled",
    notes: lecture?.notes || "",
  });
  const set = (field: keyof typeof form, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const chooseTeacher = user?.role !== "teacher";

  const { data: batches } = useQuery({ queryKey: ["/api/batches"], queryFn: () => api.get<Batch[]>("/api/batches") });
  const { data: teachers } = useQuery({
    queryKey: ["/api/lectures/teachers"],
    queryFn: () => api.get<Person[]>("/api/lectures/teachers"),
    enabled: chooseTeacher,
  });

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/lectures"] });
    onClose();
  };
  const failed = (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: () => {
      const { teacherId, status, ...rest } = form;
      const body = { ...rest, ...(chooseTeacher && teacherId ? { teacherId } : {}) };
      return lecture ? api.put(`/api/lectures/${lecture._id}`, { ...body, status }) : api.post("/api/lectures", body);
    },
    onSuccess: done,
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/lectures/${lecture?._id}`),
    onSuccess: done,
    onError: failed,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lecture ? "Edit Lecture" : "New Lecture"}</DialogTitle>
          <DialogDescription>A lecture can't overlap another for the same teacher or batch.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1">
            <Label htmlFor="lecture-title">Title or topic</Label>
            <Input id="lecture-title" required maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} data-testid="input-lecture-title" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Picker label="Batch" value={form.batchId} onChange={(v) => set("batchId", v)} options={(batches || []).map((b) => ({ value: b._id, label: b.batchName }))} testId="select-lecture-batch" />
            {chooseTeacher && <Picker label="Teacher" value={form.teacherId} onChange={(v) => set("teacherId", v)} options={peopleOptions(teachers)} placeholder="Batch teacher" testId="select-lecture-teacher" />}
            <div className="space-y-1">
              <Label htmlFor="lecture-date">Date</Label>
              <Input id="lecture-date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} data-testid="input-lecture-date" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="lecture-start">Start</Label>
                <Input id="lecture-start" type="time" required value={form.startTime} onChange={(e) => set("startTime", e.target.value)} data-testid="input-lecture-start" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lecture-end">End</Label>
                <Input id="lecture-end" type="time" required value={form.endTime} onChange={(e) => set("endTime", e.target.value)} data-testid="input-lecture-end" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lecture-room">Room or link</Label>
              <Input id="lecture-room" maxLength={300} value={form.room} onChange={(e) => set("room", e.target.value)} data-testid="input-lecture-room" />
            </div>
            {lecture && <Picker label="Status" value={form.status} onChange={(v) => set("status", v)} options={toOptions(LECTURE_STATUSES)} testId="select-lecture-status" />}
          </div>
          <div className="space-y-1">
            <Label htmlFor="lecture-notes">Notes</Label>
            <Textarea id="lecture-notes" rows={2} maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} data-testid="input-lecture-notes" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={save.isPending || !form.batchId} data-testid="button-submit-lecture">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Lecture
            </Button>
            {lecture && <Button type="button" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()} data-testid="button-delete-lecture">Delete</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
