import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { peopleOptions, type Batch, type Course, type Person } from "@/academy/lib/academy";
import { Picker } from "@/academy/components/common";

interface Props {
  defaultDate: string;
  chooseTeacher: boolean;
  onCreated: (batch: Batch) => void;
  onCancel: () => void;
}

// Creates a batch inline from the lecture dialog, so the new batch can be picked right away.
export default function QuickBatchForm({ defaultDate, chooseTeacher, onCreated, onCancel }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [form, setForm] = useState({ courseId: "", batchName: "", startDate: defaultDate, endDate: defaultDate, teacherId: "" });
  const set = (field: keyof typeof form, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses") });
  const { data: teachers } = useQuery({
    queryKey: ["/api/lectures/teachers"],
    queryFn: () => api.get<Person[]>("/api/lectures/teachers"),
    enabled: chooseTeacher,
  });

  const create = useMutation({
    mutationFn: () => api.post<Batch>("/api/batches", {
      courseId: form.courseId,
      batchName: form.batchName.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      ...(chooseTeacher ? { teacherId: form.teacherId } : {}),
    }),
    onSuccess: async (batch) => {
      // Wait for the refreshed list: a Select given a value it has no option for clears it.
      await queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      toast({ title: "Batch created", description: batch.batchName });
      onCreated(batch);
    },
    onError: (err: Error) => toast({ title: "Batch not created", description: err.message, variant: "destructive" }),
  });

  const ready = !!form.courseId && !!form.batchName.trim() && !!form.startDate && !!form.endDate && form.endDate >= form.startDate && (!chooseTeacher || !!form.teacherId);

  return (
    <div className="col-span-1 sm:col-span-2 rounded-md border p-3 space-y-3" data-testid="panel-quick-batch">
      <p className="text-sm font-medium">New batch</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Picker label="Course" value={form.courseId} onChange={(v) => set("courseId", v)} options={(courses || []).map((c) => ({ value: c._id, label: c.title }))} testId="select-quick-batch-course" />
        <div className="space-y-1">
          <Label htmlFor="quick-batch-name">Batch name</Label>
          <Input id="quick-batch-name" required maxLength={120} value={form.batchName} onChange={(e) => set("batchName", e.target.value)} data-testid="input-quick-batch-name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quick-batch-start">Start date</Label>
          <Input id="quick-batch-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} data-testid="input-quick-batch-start" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quick-batch-end">End date</Label>
          <Input id="quick-batch-end" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set("endDate", e.target.value)} data-testid="input-quick-batch-end" />
        </div>
        {chooseTeacher && <Picker label="Batch teacher" value={form.teacherId} onChange={(v) => set("teacherId", v)} options={peopleOptions(teachers)} testId="select-quick-batch-teacher" />}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} data-testid="button-create-quick-batch">
          {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create batch
        </Button>
      </div>
    </div>
  );
}
