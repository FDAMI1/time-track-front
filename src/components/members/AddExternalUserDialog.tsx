import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { queryClient } from "@/lib/queryClient";

interface ExternalStudent { _id: string; name: string; studentId: string; phone: string }

const EMPTY = { name: "", studentId: "", phone: "" };
const MANAGE_URL = "/mcq/external-results?tab=students";

// An external user takes MCQ tests through a public share link with their Student ID.
// They are MCQ external students, not portal accounts, so they can never sign in.
export default function AddExternalUserDialog() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState<ExternalStudent | null>(null);

  const save = useMutation({
    mutationFn: () => api.post<ExternalStudent>("/api/mcq/external/students", {
      name: form.name.trim(),
      ...(form.studentId.trim() ? { studentId: form.studentId.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }),
    onSuccess: (student) => {
      setCreated(student);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["/api/mcq/external/students"] });
      toast({ title: "External user created", description: `Student ID ${student.studentId}` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) { setCreated(null); setForm(EMPTY); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-external-user"><UserPlus className="w-4 h-4 mr-2" />Add External User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add External User</DialogTitle>
          <DialogDescription>For someone outside the academy who takes MCQ tests through a shared test link. They can't sign in to the portal.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-4" data-testid="external-user-created">
            <p className="text-sm">Give <b>{created.name}</b> this Student ID. They enter it on the test link to start.</p>
            <p className="text-2xl font-mono font-bold tracking-wider" data-testid="text-external-student-id">{created.studentId}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCreated(null)} data-testid="button-add-another-external">Add Another</Button>
              <Button variant="outline" asChild><Link href={MANAGE_URL}><ExternalLink className="w-4 h-4 mr-2" />Manage External Users</Link></Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="external-name">Full Name *</Label>
              <Input id="external-name" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-external-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-student-id">Student ID</Label>
              <Input id="external-student-id" maxLength={40} placeholder="Leave empty to create one" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value.toUpperCase() })} data-testid="input-external-student-id" />
              <p className="text-xs text-muted-foreground">Letters, numbers and dashes. Must be unique in your academy.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-phone">Phone Number</Label>
              <Input id="external-phone" type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-external-phone" />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending || form.name.trim().length < 2} data-testid="button-save-external-user">
              {save.isPending ? "Saving..." : "Create External User"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
