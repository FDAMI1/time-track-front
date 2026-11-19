import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from "lucide-react";

// One permission a role starts with, from the server's permission list (utils/permissions.js).
interface Permission {
  _id: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  _id: string;
  roleName: string;
  description: string;
  isSystem?: boolean;
  baseRole?: string;
  permissions: Permission[];
  createdAt: string;
}

interface RoleForm { roleName: string; description: string; baseRole: string }

// A custom role is a job title on top of one of these; access follows the built-in role.
const BASE_ROLES: Record<string, string[]> = { academy: ["teacher", "student", "manager", "employee", "member"], company: ["manager", "employee", "member"] };
const BASE_LABELS: Record<string, string> = { teacher: "Teacher", student: "Student", manager: "Manager", employee: "Employee", member: "Member" };

function BaseRoleSelect({ value, onChange, orgType }: { value: string; onChange: (v: string) => void; orgType: string }) {
  return (
    <div className="space-y-1.5">
      <Label>Works as</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger data-testid="select-role-base"><SelectValue placeholder="Choose a built-in role" /></SelectTrigger>
        <SelectContent>
          {(BASE_ROLES[orgType] || BASE_ROLES.company).map((r) => <SelectItem key={r} value={r}>{BASE_LABELS[r]}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">People with this role get the pages, data and default permissions of the built-in role you choose.</p>
    </div>
  );
}

function RoleDialog({ title, open, form, setForm, orgType, pending, submitLabel, onSubmit, onClose }: {
  title: string; open: boolean; form: RoleForm; setForm: (f: RoleForm) => void; orgType: string;
  pending: boolean; submitLabel: string; onSubmit: () => void; onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>A custom role is a job title. What its people can open follows the built-in role it works as.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Role Name</Label>
            <Input id="role-name" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="e.g. Counsellor" data-testid="input-role-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input id="role-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe this role" data-testid="input-role-description" />
          </div>
          <BaseRoleSelect value={form.baseRole} onChange={(baseRole) => setForm({ ...form, baseRole })} orgType={orgType} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={pending || !form.roleName.trim() || !form.baseRole} data-testid="button-submit-role">
            {pending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDetail({ role }: { role: Role }) {
  const groups: Record<string, Permission[]> = {};
  for (const p of role.permissions) (groups[p.resource] ||= []).push(p);
  const everything = role.roleName === "org_admin";
  return (
    <div className="border rounded-lg p-5 space-y-4" data-testid="panel-role-detail">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><ShieldCheck className="w-5 h-5 text-primary" /></div>
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{role.roleName}</h2>
          <p className="text-sm text-muted-foreground">
            {role.isSystem ? role.description : role.baseRole ? `Works as ${BASE_LABELS[role.baseRole]}` : "Choose which built-in role it works as"}
          </p>
        </div>
      </div>
      {role.permissions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {role.isSystem ? "This role starts with no permissions." : "Edit the role and choose what it works as to give it permissions."}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {everything ? "Admins have every permission." : `Starts with these ${role.permissions.length} permissions.`} An admin can add or remove them for one person on Edit Member.
          </p>
          {Object.entries(groups).map(([group, perms]) => (
            <div key={group} className="border rounded-lg p-3">
              <p className="text-sm font-medium mb-2">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {perms.map((p) => <Badge key={p._id} variant="secondary" className="text-xs" title={p.description}>{p.action}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RolesPermissionsPage() {
  const { token, user } = useAuth();
  const orgType = user?.organizationId?.type || "company";
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>({ roleName: "", description: "", baseRole: "" });

  const { data: roles = [], isLoading: loadingRoles, error } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const res = await apiFetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load roles");
      return res.json();
    },
    enabled: !!token,
  });
  // Read from the list, so the detail always shows what the server computed after a save.
  const selectedRole = roles.find((r) => r._id === selectedId) || null;

  const send = async (url: string, method: string, body?: RoleForm) => {
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data as Role;
  };
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });
  const saved = (role: Role, title: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    setSelectedId(role._id);
    toast({ title });
  };

  const createMutation = useMutation({
    mutationFn: (data: RoleForm) => send("/api/roles", "POST", data),
    onSuccess: (role) => { setCreateOpen(false); saved(role, "Role created"); },
    onError: failed,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleForm }) => send(`/api/roles/${id}`, "PUT", data),
    onSuccess: (role) => { setEditRole(null); saved(role, "Role updated"); },
    onError: failed,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => send(`/api/roles/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      toast({ title: "Role deleted" });
    },
    onError: failed,
  });

  const openCreate = () => { setForm({ roleName: "", description: "", baseRole: "" }); setCreateOpen(true); };
  const openEdit = (role: Role) => { setForm({ roleName: role.roleName, description: role.description, baseRole: role.baseRole || "" }); setEditRole(role); };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title" data-testid="text-page-title">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm mt-1">What each role starts with, and custom roles for your own job titles</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-role"><Plus className="w-4 h-4 mr-2" /> New Role</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">Roles ({roles.length})</p>
          {loadingRoles ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : (
            roles.map((role) => (
              <div
                key={role._id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(role._id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(role._id); } }}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedId === role._id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                data-testid={`card-role-${role._id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{role.roleName}</p>
                      {role.isSystem && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">System</Badge>}
                    </div>
                    {role.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{role.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {!role.isSystem && (role.baseRole ? `Works as ${BASE_LABELS[role.baseRole]} · ` : "Choose what it works as · ")}
                      {role.permissions.length} permissions
                    </p>
                  </div>
                  {!role.isSystem && (
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Edit ${role.roleName}`} onClick={(e) => { e.stopPropagation(); openEdit(role); }} data-testid={`button-edit-role-${role._id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" aria-label={`Delete ${role.roleName}`} onClick={(e) => { e.stopPropagation(); setDeleteId(role._id); }} data-testid={`button-delete-role-${role._id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {selectedRole ? <RoleDetail role={selectedRole} /> : (
            <div className="border rounded-lg flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a role to view its permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <RoleDialog
        title="Create New Role" open={createOpen} form={form} setForm={setForm} orgType={orgType}
        pending={createMutation.isPending} submitLabel="Create Role"
        onSubmit={() => createMutation.mutate(form)} onClose={() => setCreateOpen(false)}
      />
      <RoleDialog
        title="Edit Role" open={!!editRole} form={form} setForm={setForm} orgType={orgType}
        pending={updateMutation.isPending} submitLabel="Save Changes"
        onSubmit={() => editRole && updateMutation.mutate({ id: editRole._id, data: form })} onClose={() => setEditRole(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>The role is deleted. People who had it keep working as its built-in role.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-confirm-delete-role">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
