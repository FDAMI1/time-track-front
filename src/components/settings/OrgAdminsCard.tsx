import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Pencil, Plus, Power, ShieldCheck, Trash2 } from "lucide-react";

interface Org { _id: string; name: string }
interface Admin { _id: string; firstName: string; lastName: string; username: string; email: string; isActive: boolean; mustChangePassword?: boolean }
type Form = { firstName: string; lastName: string; username: string; email: string; password: string };

const EMPTY: Form = { firstName: "", lastName: "", username: "", email: "", password: "" };

// Super Admin only: each organization's admin logins. Passwords are never shown; a new one is set,
// or a temporary one is generated and shown once. Every change is checked again on the server.
export default function OrgAdminsCard() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [orgId, setOrgId] = useState("");
  const [editing, setEditing] = useState<Admin | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [passwordFor, setPasswordFor] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [deleting, setDeleting] = useState<Admin | null>(null);

  const { data: orgs = [] } = useQuery({ queryKey: ["/api/organizations"], queryFn: () => api.get<Org[]>("/api/organizations") });
  const adminsKey = ["/api/organizations", orgId, "admins"];
  const { data, isLoading } = useQuery({
    queryKey: adminsKey,
    queryFn: () => api.get<{ admins: Admin[] }>(`/api/organizations/${orgId}/admins`),
    enabled: !!orgId,
  });
  const admins = data?.admins || [];
  const base = `/api/organizations/${orgId}/admins`;

  const run = <T,>(fn: (input: T) => Promise<unknown>, done: string, after?: (result: any) => void) => ({
    mutationFn: fn,
    onSuccess: (result: unknown) => { toast({ title: done }); queryClient.invalidateQueries({ queryKey: adminsKey }); after?.(result); },
    onError: (err: Error) => toast({ title: "Admin accounts", description: err.message, variant: "destructive" }),
  });

  const save = useMutation(run<Form>((f) => {
    if (editing === "new") return api.post(base, f);
    const { password: _unused, ...details } = f;
    return api.put(`${base}/${(editing as Admin)._id}`, details);
  }, editing === "new" ? "Admin created" : "Admin updated", () => setEditing(null)));
  const setActive = useMutation(run<Admin>((a) => api.put(`${base}/${a._id}`, { isActive: !a.isActive }), "Admin status updated"));
  const remove = useMutation(run<Admin>((a) => api.delete(`${base}/${a._id}`), "Admin deleted", () => setDeleting(null)));
  const password = useMutation(run<{ admin: Admin; value: string }>(
    ({ admin, value }) => api.post(`${base}/${admin._id}/password`, value ? { password: value } : {}),
    "Password updated. The admin has been signed out.",
    (result: { tempPassword?: string }) => { setNewPassword(""); if (result?.tempPassword) setTempPassword(result.tempPassword); else setPasswordFor(null); },
  ));

  const openForm = (target: Admin | "new") => {
    setForm(target === "new" ? EMPTY : { firstName: target.firstName, lastName: target.lastName, username: target.username, email: target.email, password: "" });
    setEditing(target);
  };
  const field = (key: keyof Form, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`admin-${key}`}>{label}</Label>
      <Input id={`admin-${key}`} type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} autoComplete="off" data-testid={`input-admin-${key}`} />
    </div>
  );

  return (
    <Card data-testid="card-org-admins">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Admin Accounts</CardTitle>
        <CardDescription>Manage each organization's admin logins: usernames, passwords and access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger data-testid="select-admin-org"><SelectValue placeholder="Choose an organization" /></SelectTrigger>
              <SelectContent>{orgs.map((o) => <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="gap-2" disabled={!orgId} onClick={() => openForm("new")} data-testid="button-add-admin"><Plus className="w-4 h-4" />Add Admin</Button>
        </div>

        {orgId && (isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">This organization has no admin accounts.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {admins.map((a) => (
              <div key={a._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3" data-testid={`row-admin-${a._id}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {a.firstName} {a.lastName}
                    <Badge variant={a.isActive ? "secondary" : "outline"}>{a.isActive ? "Active" : "Inactive"}</Badge>
                    {a.mustChangePassword && <Badge variant="outline">Must change password</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{a.username} · {a.email} · {orgs.find((o) => o._id === orgId)?.name}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openForm(a)} data-testid={`button-edit-admin-${a._id}`}><Pencil className="w-3.5 h-3.5" />Edit</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPasswordFor(a); setTempPassword(""); setNewPassword(""); }} data-testid={`button-password-admin-${a._id}`}><KeyRound className="w-3.5 h-3.5" />Password</Button>
                  <Button variant="outline" size="sm" className="gap-1" disabled={setActive.isPending} onClick={() => setActive.mutate(a)} data-testid={`button-toggle-admin-${a._id}`}><Power className="w-3.5 h-3.5" />{a.isActive ? "Deactivate" : "Activate"}</Button>
                  <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => setDeleting(a)} aria-label={`Delete ${a.username}`} data-testid={`button-delete-admin-${a._id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Admin" : "Edit Admin"}</DialogTitle>
            <DialogDescription>{editing === "new" ? "The new admin can sign in with this username and password." : "Changing the username changes how this admin signs in."}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div className="grid grid-cols-2 gap-3">{field("firstName", "First name")}{field("lastName", "Last name")}</div>
            {field("username", "Username")}
            {field("email", "Email", "email")}
            {editing === "new" && field("password", "Password", "password")}
            <Button type="submit" className="w-full" disabled={save.isPending} data-testid="button-save-admin">{editing === "new" ? "Create Admin" : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordFor !== null} onOpenChange={(open) => { if (!open) { setPasswordFor(null); setTempPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password for @{passwordFor?.username}</DialogTitle>
            <DialogDescription>The old password stops working and the admin is signed out everywhere.</DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-3">
              <p className="text-sm">Temporary password (shown once). The admin must change it at the next sign-in:</p>
              <code className="block rounded-md bg-muted p-3 text-sm font-mono break-all select-all" data-testid="text-temp-password">{tempPassword}</code>
              <Button className="w-full" onClick={() => { setPasswordFor(null); setTempPassword(""); }}>Done</Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (passwordFor) password.mutate({ admin: passwordFor, value: newPassword }); }}>
              <div className="space-y-1.5">
                <Label htmlFor="admin-new-password">New password</Label>
                <Input id="admin-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" data-testid="input-admin-new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={!newPassword || password.isPending} data-testid="button-set-admin-password">Set Password</Button>
              <Button type="button" variant="outline" className="w-full" disabled={password.isPending} onClick={() => passwordFor && password.mutate({ admin: passwordFor, value: "" })} data-testid="button-reset-admin-password">
                Generate Temporary Password
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete @{deleting?.username}?</AlertDialogTitle>
            <AlertDialogDescription>This admin can no longer sign in. The organization and its members are not changed. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting); }} data-testid="button-confirm-delete-admin">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
