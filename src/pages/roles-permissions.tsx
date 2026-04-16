import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  read: "Read",
  update: "Update",
  delete: "Delete",
};

const MODULE_LABELS: Record<string, string> = {
  users: "Users",
  organizations: "Organizations",
  roles: "Roles",
  permissions: "Permissions",
  classes: "Classes",
  courses: "Courses",
  batches: "Batches",
  student_progress: "Student Progress",
  departments: "Departments",
  attendance: "Attendance",
  attendance_policies: "Attendance Policies",
  time_tracking: "Time Tracking",
  leave_requests: "Leave Requests",
  leaves: "Leaves",
  leave_policies: "Leave Policies",
  reimbursements: "Reimbursements",
  salary_structures: "Salary Structures",
  salary_config: "Salary Config",
  tasks: "Tasks",
  projects: "Projects",
  chat: "Chat",
  notifications: "Notifications",
  documents: "Documents",
  document_templates: "Document Templates",
  reports: "Reports",
  activity_logs: "Activity Logs",
  organization_assets: "Organization Assets",
};

const MODULE_GROUPS: { label: string; modules: string[] }[] = [
  { label: "User Management", modules: ["users", "organizations", "roles", "permissions"] },
  { label: "Academic", modules: ["classes", "courses", "batches", "student_progress", "departments"] },
  { label: "HR & Workforce", modules: ["attendance", "attendance_policies", "time_tracking", "leave_requests", "leaves", "leave_policies", "reimbursements", "salary_structures", "salary_config"] },
  { label: "Projects & Tasks", modules: ["tasks", "projects"] },
  { label: "Communication", modules: ["chat", "notifications"] },
  { label: "Documents & Reports", modules: ["documents", "document_templates", "reports", "activity_logs"] },
  { label: "Assets", modules: ["organization_assets"] },
];

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
  permissions: Permission[];
  createdAt: string;
}

function PermissionsSelector({
  allPermissions,
  grouped,
  selectedIds,
  onChange,
}: {
  allPermissions: Permission[];
  grouped: Record<string, string[]>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  function toggleModule(mod: string) {
    setOpenModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  }

  function getPermissionId(resource: string, action: string) {
    return allPermissions.find((p) => p.resource === resource && p.action === action)?._id;
  }

  function isChecked(resource: string, action: string) {
    const id = getPermissionId(resource, action);
    return id ? selectedIds.includes(id) : false;
  }

  function togglePermission(resource: string, action: string) {
    const id = getPermissionId(resource, action);
    if (!id) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleAll(resource: string) {
    const modulePerms = allPermissions.filter((p) => p.resource === resource);
    const allChecked = modulePerms.every((p) => selectedIds.includes(p._id));
    if (allChecked) {
      onChange(selectedIds.filter((id) => !modulePerms.map((p) => p._id).includes(id)));
    } else {
      const ids = modulePerms.map((p) => p._id);
      onChange([...new Set([...selectedIds, ...ids])]);
    }
  }

  function renderModuleCollapsible(resource: string, actions: string[]) {
    const modulePerms = allPermissions.filter((p) => p.resource === resource);
    const allChecked = modulePerms.length > 0 && modulePerms.every((p) => selectedIds.includes(p._id));
    const someChecked = modulePerms.some((p) => selectedIds.includes(p._id));
    const isOpen = openModules[resource] ?? false;
    return (
      <Collapsible key={resource} open={isOpen} onOpenChange={() => toggleModule(resource)}>
        <div className="border rounded-lg overflow-hidden">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={allChecked}
                  data-state={someChecked && !allChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                  onCheckedChange={() => toggleAll(resource)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`checkbox-module-all-${resource}`}
                />
                <span className="text-sm font-medium">{MODULE_LABELS[resource] || resource}</span>
                {someChecked && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {modulePerms.filter((p) => selectedIds.includes(p._id)).length}/{modulePerms.length}
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-2 grid grid-cols-2 gap-2 border-t bg-background">
              {actions.map((action) => (
                <label key={action} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                  <Checkbox
                    checked={isChecked(resource, action)}
                    onCheckedChange={() => togglePermission(resource, action)}
                    data-testid={`checkbox-perm-${resource}-${action}`}
                  />
                  {ACTION_LABELS[action] || action}
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  const groupedModuleSet = new Set(MODULE_GROUPS.flatMap((g) => g.modules));
  const ungroupedModules = Object.keys(grouped).filter((m) => !groupedModuleSet.has(m));

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {MODULE_GROUPS.map((group) => {
        const groupModules = group.modules.filter((m) => grouped[m]);
        if (groupModules.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">{group.label}</p>
            <div className="space-y-1.5">
              {groupModules.map((resource) => renderModuleCollapsible(resource, grouped[resource] || []))}
            </div>
          </div>
        );
      })}
      {ungroupedModules.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">Other</p>
          <div className="space-y-1.5">
            {ungroupedModules.map((resource) => renderModuleCollapsible(resource, grouped[resource] || []))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolesPermissionsPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [form, setForm] = useState({ roleName: "", description: "" });
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const { data: roles = [], isLoading: loadingRoles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const res = await apiFetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load roles");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: permsData } = useQuery<{ permissions: Permission[]; grouped: Record<string, string[]> }>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      const res = await apiFetch("/api/permissions", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load permissions");
      return res.json();
    },
    enabled: !!token,
  });

  const allPermissions = permsData?.permissions ?? [];
  const grouped = permsData?.grouped ?? {};

  const createMutation = useMutation({
    mutationFn: async (data: { roleName: string; description: string; permissionIds: string[] }) => {
      const res = await apiFetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setCreateOpen(false);
      resetForm();
      setSelectedRole(role);
      toast({ title: "Role created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiFetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setEditRole(null);
      setSelectedRole(role);
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/roles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeleteId(null);
      if (selectedRole?._id === deleteId) setSelectedRole(null);
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ roleName: "", description: "" });
    setSelectedPermIds([]);
  }

  function openEdit(role: Role) {
    setEditRole(role);
    setForm({ roleName: role.roleName, description: role.description });
    setSelectedPermIds(role.permissions.map((p) => p._id));
  }

  const groupedByModule = (permissions: Permission[]) => {
    const map: Record<string, Permission[]> = {};
    for (const p of permissions) {
      if (!map[p.resource]) map[p.resource] = [];
      map[p.resource].push(p);
    }
    return map;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm mt-1">Create custom roles and assign module-level permissions</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} data-testid="button-create-role">
          <Plus className="w-4 h-4 mr-2" /> New Role
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">Roles ({roles.length})</p>
          <div className="overflow-y-auto max-h-[60vh] md:max-h-none space-y-2 pr-0.5">
          {loadingRoles ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No roles yet</p>
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role._id}
                onClick={() => setSelectedRole(role)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRole?._id === role._id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                data-testid={`card-role-${role._id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{role.roleName}</p>
                      {role.isSystem && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">System</Badge>
                      )}
                    </div>
                    {role.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{role.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{role.permissions.length} permissions</p>
                  </div>
                  {!role.isSystem && (
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEdit(role); }}
                        data-testid={`button-edit-role-${role._id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(role._id); }}
                        data-testid={`button-delete-role-${role._id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedRole ? (
            <div className="border rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{selectedRole.roleName}</h2>
                  {selectedRole.description && <p className="text-sm text-muted-foreground">{selectedRole.description}</p>}
                </div>
              </div>
              {selectedRole.permissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No permissions assigned to this role</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => openEdit(selectedRole)}>
                    Assign Permissions
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Assigned Permissions ({selectedRole.permissions.length})</p>
                  {Object.entries(groupedByModule(selectedRole.permissions)).map(([resource, perms]) => (
                    <div key={resource} className="border rounded-lg p-3">
                      <p className="text-sm font-medium mb-2">{MODULE_LABELS[resource] || resource}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {perms.map((p) => (
                          <Badge key={p._id} variant="secondary" className="text-xs capitalize">
                            {p.action}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a role to view its permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role Name</Label>
              <Input
                value={form.roleName}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                placeholder="e.g. Content Manager"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Briefly describe this role"
                data-testid="input-role-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              {Object.keys(grouped).length === 0 ? (
                <Skeleton className="h-40" />
              ) : (
                <PermissionsSelector
                  allPermissions={allPermissions}
                  grouped={grouped}
                  selectedIds={selectedPermIds}
                  onChange={setSelectedPermIds}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ ...form, permissionIds: selectedPermIds })}
              disabled={createMutation.isPending || !form.roleName.trim()}
              data-testid="button-submit-create-role"
            >
              {createMutation.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRole} onOpenChange={() => setEditRole(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role Name</Label>
              <Input
                value={form.roleName}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                data-testid="input-edit-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="input-edit-role-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              {Object.keys(grouped).length === 0 ? (
                <Skeleton className="h-40" />
              ) : (
                <PermissionsSelector
                  allPermissions={allPermissions}
                  grouped={grouped}
                  selectedIds={selectedPermIds}
                  onChange={setSelectedPermIds}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editRole!._id, data: { ...form, permissionIds: selectedPermIds } })}
              disabled={updateMutation.isPending || !form.roleName.trim()}
              data-testid="button-submit-edit-role"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role and all its permission assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteId!)}
              data-testid="button-confirm-delete-role"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
