import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch, safeJson } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Leave {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
  halfDayPeriod?: string;
  userId?: { firstName?: string; lastName?: string } | string;
}

interface Props {
  leave: Leave;
  token: string;
  types: Record<string, string>;
  onClose: () => void;
}

// Admins only: corrects someone's leave request. The server checks the dates and overlaps again.
export default function EditLeaveDialog({ leave, token, types, onClose }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({ leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate, reason: leave.reason });
  const half = !!leave.isHalfDay;
  const who = typeof leave.userId === "object" ? `${leave.userId.firstName || ""} ${leave.userId.lastName || ""}`.trim() : "";

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, endDate: half ? form.startDate : form.endDate, isHalfDay: half, halfDayPeriod: leave.halfDayPeriod || "" };
      const res = await apiFetch(`/api/leaves/${leave._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await safeJson(res))?.message || "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaves/my"] });
      toast({ title: "Leave request updated" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit leave request</DialogTitle>
          <DialogDescription>{who ? `${who}'s request. ` : ""}Its status stays as it is.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1">
            <Label>Leave type</Label>
            <Select value={form.leaveType} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
              <SelectTrigger data-testid="select-edit-leave-type"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(types).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="edit-leave-start">{half ? "Date" : "Start date"}</Label>
              <Input id="edit-leave-start" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-edit-leave-start" />
            </div>
            {!half && (
              <div className="space-y-1">
                <Label htmlFor="edit-leave-end">End date</Label>
                <Input id="edit-leave-end" type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-edit-leave-end" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-leave-reason">Reason</Label>
            <Textarea id="edit-leave-reason" required maxLength={1000} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="input-edit-leave-reason" />
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending} data-testid="button-save-leave">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
