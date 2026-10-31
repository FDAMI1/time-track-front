import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Layers, Loader2, Plus } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { formatMoney, toMinor, type Batch, type Course, type FeePlan } from "@/academy/lib/academy";
import { ListState, Picker } from "@/academy/components/common";

const EMPTY = { name: "", amount: "", target: "", targetId: "" };

export default function FeePlans({ isAdmin }: { isAdmin: boolean }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  const [billing, setBilling] = useState<FeePlan | null>(null);
  const [dueDate, setDueDate] = useState("");
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const { data: plans, isLoading, error } = useQuery({ queryKey: ["/api/fees", "plans"], queryFn: () => api.get<FeePlan[]>("/api/fees/plans") });
  const { data: courses } = useQuery({ queryKey: ["/api/courses"], queryFn: () => api.get<Course[]>("/api/courses"), enabled: isAdmin });
  const { data: batches } = useQuery({ queryKey: ["/api/batches"], queryFn: () => api.get<Batch[]>("/api/batches"), enabled: isAdmin });

  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const create = useMutation({
    mutationFn: () => {
      const amountMinor = toMinor(form.amount);
      if (!amountMinor) throw new Error("Enter an amount such as 1500 or 1500.50");
      return api.post("/api/fees/plans", { name: form.name, amountMinor, [form.target]: form.targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees", "plans"] });
      setCreateOpen(false);
      setForm(EMPTY);
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/fees/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fees", "plans"] }),
    onError: failed,
  });
  const bill = useMutation({
    mutationFn: () => api.post<{ created: number; skipped: number }>(`/api/fees/plans/${billing?._id}/invoices`, { dueDate }),
    onSuccess: ({ created, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      setBilling(null);
      setDueDate("");
      toast({ title: `${created} invoices created`, description: skipped ? `${skipped} students were already billed for this date` : undefined });
    },
    onError: failed,
  });

  const targets = form.target === "courseId"
    ? (courses || []).map((c) => ({ value: c._id, label: c.title }))
    : (batches || []).map((b) => ({ value: b._id, label: b.batchName }));

  return (
    <div className="space-y-4">
      {isAdmin && <Button onClick={() => setCreateOpen(true)} data-testid="button-new-plan"><Plus className="w-4 h-4 mr-2" />New Plan</Button>}

      <ListState isLoading={isLoading} error={error} isEmpty={(plans || []).length === 0} emptyText="No fee plans yet" icon={Layers}>
        <div className="space-y-2">
          {(plans || []).map((plan) => (
            <Card key={plan._id} data-testid={`card-plan-${plan._id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium break-words">{plan.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatMoney(plan.amountMinor)} · {plan.courseId?.title || plan.batchId?.batchName}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setBilling(plan)} data-testid={`button-bill-plan-${plan._id}`}>Create Invoices</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(plan._id)} data-testid={`button-delete-plan-${plan._id}`}>Delete</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ListState>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Fee Plan</DialogTitle>
            <DialogDescription>A plan sets the fee for everyone in a course or a batch.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="plan-name">Name</Label>
              <Input id="plan-name" required maxLength={150} value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="input-plan-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-amount">Amount (₹)</Label>
              <Input id="plan-amount" required inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} data-testid="input-plan-amount" />
            </div>
            <Picker label="Applies to" value={form.target} onChange={(v) => setForm((f) => ({ ...f, target: v, targetId: "" }))} options={[{ value: "courseId", label: "A course" }, { value: "batchId", label: "A batch" }]} testId="select-plan-target" />
            {form.target && <Picker label={form.target === "courseId" ? "Course" : "Batch"} value={form.targetId} onChange={(v) => set("targetId", v)} options={targets} testId="select-plan-target-id" />}
            <Button type="submit" className="w-full" disabled={create.isPending || !form.targetId} data-testid="button-submit-plan">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Plan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!billing} onOpenChange={(open) => { if (!open) setBilling(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Invoices</DialogTitle>
            <DialogDescription>Bills each current student of {billing?.name} once for this due date. It's safe to run again for students who join later.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); bill.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="plan-due">Due date</Label>
              <Input id="plan-due" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-plan-due" />
            </div>
            <Button type="submit" className="w-full" disabled={bill.isPending} data-testid="button-submit-bill">Create Invoices</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
