import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Users, Copy } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqExternalStudent } from "@/mcq/lib/types";

// External students are people without a portal account. They receive a
// generated Student ID and take tests through the public share link.
export default function ExternalStudentsPanel() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McqExternalStudent | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });

  const { data: students, isLoading } = useQuery({
    queryKey: ["/api/mcq/external/students"],
    queryFn: () => api.get<McqExternalStudent[]>("/api/mcq/external/students"),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/mcq/external/students"] });

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/api/mcq/external/students/${editing._id}`, form) : api.post("/api/mcq/external/students", form)),
    onSuccess: () => {
      refresh();
      setDialogOpen(false);
      toast({ title: editing ? "External student updated" : "External student created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/external/students/${id}`),
    onSuccess: () => { refresh(); toast({ title: "External student deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", phone: "" }); setDialogOpen(true); };
  const openEdit = (s: McqExternalStudent) => { setEditing(s); setForm({ name: s.name, phone: s.phone || "" }); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{students?.length || 0} external student(s). Share the generated Student ID with them along with a test link.</p>
        <Button size="sm" onClick={openCreate} data-testid="button-add-external-student"><Plus className="w-4 h-4 mr-2" />Add Student</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !students || students.length === 0 ? (
        <Card><CardContent className="p-10 text-center"><Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground text-sm">No external students yet</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Student ID</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-external-student-${s._id}`}>
                  <td className="py-2.5 px-3 font-medium text-foreground">{s.name}</td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-1.5 py-0.5 rounded hover:bg-muted/70"
                      onClick={() => { navigator.clipboard.writeText(s.studentId); toast({ title: "Student ID copied" }); }}
                      title="Copy Student ID"
                    >
                      {s.studentId}<Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{s.phone || "—"}</td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)} data-testid={`button-edit-external-${s._id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-delete-external-${s._id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete External Student</AlertDialogTitle>
                            <AlertDialogDescription>Delete {s.name} ({s.studentId})? They will no longer be able to start public tests.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(s._id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit External Student" : "Add External Student"}</DialogTitle>
            <DialogDescription>{editing ? `Student ID ${editing.studentId} stays the same.` : "A unique Student ID will be generated automatically."}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required minLength={2} data-testid="input-external-name" />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" data-testid="input-external-phone" />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending} data-testid="button-save-external-student">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Student"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
