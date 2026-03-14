import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Users, Pencil, Trash2, Eye, EyeOff, Phone, GraduationCap, MessageCircle, Clock, KeyRound, Copy, Check, RefreshCw, Lock } from "lucide-react";

const roleLabels: Record<string, string> = {
  org_admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  manager: "Manager",
  employee: "Employee",
};

const roleBadgeColors: Record<string, string> = {
  org_admin: "bg-chart-2/10 text-chart-2",
  teacher: "bg-chart-3/10 text-chart-3",
  student: "bg-chart-4/10 text-chart-4",
  manager: "bg-chart-1/10 text-chart-1",
  employee: "bg-chart-5/10 text-chart-5",
};

export default function MembersPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetMode, setResetMode] = useState<"auto" | "manual">("auto");
  const [resetManualPassword, setResetManualPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [createPasswordMode, setCreatePasswordMode] = useState<"auto" | "manual">("auto");
  const [createdPasswordOpen, setCreatedPasswordOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdMemberName, setCreatedMemberName] = useState("");

  const orgType = user?.organizationId?.type;

  const availableRoles = orgType === "academy"
    ? [{ value: "teacher", label: "Teacher" }, { value: "student", label: "Student" }]
    : orgType === "company"
    ? [{ value: "manager", label: "Manager" }, { value: "employee", label: "Employee" }]
    : [{ value: "teacher", label: "Teacher" }, { value: "student", label: "Student" }, { value: "manager", label: "Manager" }, { value: "employee", label: "Employee" }];

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", education: "", username: "", password: "",
    role: availableRoles[0]?.value || "employee",
    studentWhatsapp: "", parentWhatsapp: "",
    assignedSchedules: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", education: "", role: "", password: "",
    studentWhatsapp: "", parentWhatsapp: "",
    assignedSchedules: [] as string[],
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: policies } = useQuery({
    queryKey: ["/api/policy"],
    queryFn: async () => {
      const res = await fetch("/api/policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = { ...data };
      if (createPasswordMode === "auto") {
        payload.password = "";
      }
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setCreateOpen(false);
      setCreatedMemberName(`${data.firstName} ${data.lastName}`);
      setTempPassword(data.generatedPassword || "");
      setCopiedPassword(false);
      setCreatedPasswordOpen(true);
      setForm({ firstName: "", lastName: "", email: "", phone: "", education: "", username: "", password: "", role: availableRoles[0]?.value || "employee", studentWhatsapp: "", parentWhatsapp: "", assignedSchedules: [] });
      setShowCreatePassword(false);
      setCreatePasswordMode("auto");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setEditOpen(false);
      setShowEditPassword(false);
      toast({ title: "Member updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Member deleted" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ id, password }: { id: string; password?: string }) => {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(password ? { password } : {}),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      setCopiedPassword(false);
      setResetConfirmOpen(false);
      setResetPasswordOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openResetDialog = (member: any) => {
    setSelectedMember(member);
    setResetMode("auto");
    setResetManualPassword("");
    setShowResetPassword(false);
    setResetConfirmOpen(true);
  };

  const handleResetSubmit = () => {
    if (!selectedMember) return;
    const password = resetMode === "manual" ? resetManualPassword : undefined;
    resetPassword.mutate({ id: selectedMember._id, password });
  };

  const openEdit = (member: any) => {
    setSelectedMember(member);
    const memberSchedules = (policies || [])
      .filter((p: any) => p.assignedMembers?.some((m: any) => {
        const mId = typeof m === "string" ? m : m._id || m;
        return mId === member._id;
      }))
      .map((p: any) => p._id);
    setEditForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || "",
      education: member.education || "",
      role: member.role,
      password: "",
      studentWhatsapp: member.studentWhatsapp || "",
      parentWhatsapp: member.parentWhatsapp || "",
      assignedSchedules: memberSchedules,
    });
    setShowEditPassword(false);
    setEditOpen(true);
  };

  const roleHierarchy: Record<string, string[]> = {
    superadmin: ["org_admin", "teacher", "student", "manager", "employee"],
    org_admin: ["teacher", "student", "manager", "employee"],
    manager: ["employee"],
    teacher: ["student"],
  };
  const canManageRole = (targetRole: string) => {
    const manageable = roleHierarchy[user?.role || ""] || [];
    return manageable.includes(targetRole);
  };

  const filtered = (members || []).filter((m: any) => {
    const matchSearch = `${m.firstName} ${m.lastName} ${m.username} ${m.email}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchRole = filterRole === "all" || m.role === filterRole;
    return matchSearch && matchRole;
  });

  const isStudentOrEmployee = (role: string) => ["student", "employee"].includes(role);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-members-title">Members</h1>
          <p className="text-muted-foreground">Manage team members in your organization</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-member">
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name</Label><Input data-testid="input-member-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
                <div><Label>Last Name</Label><Input data-testid="input-member-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
              </div>
              <div><Label>Email</Label><Input type="email" data-testid="input-member-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><Label>Phone Number</Label><Input type="tel" data-testid="input-member-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +1 234 567 8900" /></div>

              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="select-member-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isStudentOrEmployee(form.role) && (
                <div className="space-y-3 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp Numbers (Required)
                  </p>
                  <div>
                    <Label>{form.role === "student" ? "Student" : "Employee"} WhatsApp Number</Label>
                    <Input
                      type="tel"
                      data-testid="input-student-whatsapp"
                      value={form.studentWhatsapp}
                      onChange={(e) => setForm({ ...form, studentWhatsapp: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      required
                    />
                  </div>
                  <div>
                    <Label>Parent WhatsApp Number</Label>
                    <Input
                      type="tel"
                      data-testid="input-parent-whatsapp"
                      value={form.parentWhatsapp}
                      onChange={(e) => setForm({ ...form, parentWhatsapp: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      required
                    />
                  </div>
                </div>
              )}

              {policies && policies.length > 0 && (
                <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Assign to Schedule(s)
                  </p>
                  <p className="text-xs text-muted-foreground">Select which attendance sessions this member belongs to</p>
                  <div className="space-y-1.5">
                    {policies.map((p: any) => (
                      <label key={p._id} className="flex items-center gap-2 cursor-pointer py-1" data-testid={`label-schedule-create-${p._id}`}>
                        <Checkbox
                          checked={form.assignedSchedules.includes(p._id)}
                          onCheckedChange={(checked) => {
                            setForm((prev) => ({
                              ...prev,
                              assignedSchedules: checked
                                ? [...prev.assignedSchedules, p._id]
                                : prev.assignedSchedules.filter((id: string) => id !== p._id),
                            }));
                          }}
                          data-testid={`checkbox-schedule-create-${p._id}`}
                        />
                        <span className="text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">({p.startTime}–{p.endTime})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div><Label>Current Education</Label><Input data-testid="input-member-education" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="e.g. BSc Computer Science" /></div>
              <div><Label>Username</Label><Input data-testid="input-member-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
              <div className="space-y-3 p-3 rounded-md border bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${createPasswordMode === "auto" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Auto-generate</span>
                    <Switch
                      checked={createPasswordMode === "manual"}
                      onCheckedChange={(checked) => {
                        setCreatePasswordMode(checked ? "manual" : "auto");
                        if (!checked) setForm({ ...form, password: "" });
                      }}
                      data-testid="switch-create-password-mode"
                    />
                    <span className={`text-xs ${createPasswordMode === "manual" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Set manually</span>
                  </div>
                </div>
                {createPasswordMode === "auto" ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" />
                    A secure password will be auto-generated and shown after creation
                  </p>
                ) : (
                  <div className="relative">
                    <Input type={showCreatePassword ? "text" : "password"} data-testid="input-member-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="pr-10" placeholder="Enter password (min 6 characters)" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowCreatePassword(!showCreatePassword)} data-testid="button-toggle-create-password">
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The member will be required to change their password on first login.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={createUser.isPending} data-testid="button-submit-member">
                {createUser.isPending ? "Creating..." : "Create Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-members"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-role">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {availableRoles.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No members found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m._id} data-testid={`row-member-${m._id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {m.firstName[0]}{m.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                          {m.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</p>
                          )}
                          {m.education && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" />{m.education}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.username}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-md ${roleBadgeColors[m.role] || ""}`}>
                        {roleLabels[m.role] || m.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isStudentOrEmployee(m.role) && (m.studentWhatsapp || m.parentWhatsapp) ? (
                        <div className="space-y-0.5">
                          {m.studentWhatsapp && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {m.studentWhatsapp}
                            </p>
                          )}
                          {m.parentWhatsapp && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {m.parentWhatsapp}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageRole(m.role) && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} data-testid={`button-edit-member-${m._id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {["superadmin", "org_admin"].includes(user?.role || "") && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-chart-3" onClick={() => openResetDialog(m)} data-testid={`button-reset-password-${m._id}`} title="Reset Password">
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Delete ${m.firstName} ${m.lastName}?`)) deleteUser.mutate(m._id); }} data-testid={`button-delete-member-${m._id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (selectedMember) { const data: any = { ...editForm }; if (!data.password) delete data.password; updateUser.mutate({ id: selectedMember._id, data }); } }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input data-testid="input-edit-first" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required /></div>
              <div><Label>Last Name</Label><Input data-testid="input-edit-last" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required /></div>
            </div>
            <div><Label>Email</Label><Input type="email" data-testid="input-edit-email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></div>
            <div><Label>Phone Number</Label><Input type="tel" data-testid="input-edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="e.g. +1 234 567 8900" /></div>

            {isStudentOrEmployee(editForm.role) && (
              <div className="space-y-3 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Numbers
                </p>
                <div>
                  <Label>{editForm.role === "student" ? "Student" : "Employee"} WhatsApp Number</Label>
                  <Input
                    type="tel"
                    data-testid="input-edit-student-whatsapp"
                    value={editForm.studentWhatsapp}
                    onChange={(e) => setEditForm({ ...editForm, studentWhatsapp: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div>
                  <Label>Parent WhatsApp Number</Label>
                  <Input
                    type="tel"
                    data-testid="input-edit-parent-whatsapp"
                    value={editForm.parentWhatsapp}
                    onChange={(e) => setEditForm({ ...editForm, parentWhatsapp: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>
            )}

            {policies && policies.length > 0 && (
              <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Assign to Schedule(s)
                </p>
                <p className="text-xs text-muted-foreground">Select which attendance sessions this member belongs to</p>
                <div className="space-y-1.5">
                  {policies.map((p: any) => (
                    <label key={p._id} className="flex items-center gap-2 cursor-pointer py-1" data-testid={`label-schedule-edit-${p._id}`}>
                      <Checkbox
                        checked={editForm.assignedSchedules.includes(p._id)}
                        onCheckedChange={(checked) => {
                          setEditForm((prev) => ({
                            ...prev,
                            assignedSchedules: checked
                              ? [...prev.assignedSchedules, p._id]
                              : prev.assignedSchedules.filter((id: string) => id !== p._id),
                          }));
                        }}
                        data-testid={`checkbox-schedule-edit-${p._id}`}
                      />
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">({p.startTime}–{p.endTime})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div><Label>Current Education</Label><Input data-testid="input-edit-education" value={editForm.education} onChange={(e) => setEditForm({ ...editForm, education: e.target.value })} placeholder="e.g. BSc Computer Science" /></div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Password (leave empty to keep current)</Label>
              <div className="relative">
                <Input type={showEditPassword ? "text" : "password"} data-testid="input-edit-password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={6} placeholder="Min 6 characters" className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowEditPassword(!showEditPassword)} data-testid="button-toggle-edit-password">
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateUser.isPending} data-testid="button-submit-edit-member">
              {updateUser.isPending ? "Updating..." : "Update Member"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-chart-3" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reset password for <span className="font-medium text-foreground">{selectedMember?.firstName} {selectedMember?.lastName}</span>
            </p>
            <div className="space-y-3 p-3 rounded-md border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Password Method</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${resetMode === "auto" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Auto-generate</span>
                  <Switch
                    checked={resetMode === "manual"}
                    onCheckedChange={(checked) => {
                      setResetMode(checked ? "manual" : "auto");
                      if (!checked) setResetManualPassword("");
                    }}
                    data-testid="switch-reset-password-mode"
                  />
                  <span className={`text-xs ${resetMode === "manual" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Set manually</span>
                </div>
              </div>
              {resetMode === "auto" ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />
                  A secure password will be auto-generated
                </p>
              ) : (
                <div className="relative">
                  <Input
                    type={showResetPassword ? "text" : "password"}
                    value={resetManualPassword}
                    onChange={(e) => setResetManualPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    className="pr-10"
                    data-testid="input-reset-manual-password"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowResetPassword(!showResetPassword)}>
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The member will be required to change their password on their next login.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResetConfirmOpen(false)} data-testid="button-cancel-reset">
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleResetSubmit}
                disabled={resetPassword.isPending || (resetMode === "manual" && resetManualPassword.length < 6)}
                data-testid="button-confirm-reset"
              >
                {resetPassword.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-chart-2" />
              Password Reset Successful
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Password for <span className="font-medium text-foreground">{selectedMember?.firstName} {selectedMember?.lastName}</span> has been reset. Share this password with the member.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
              <code className="flex-1 text-sm font-mono font-medium" data-testid="text-temp-password">{tempPassword}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => { navigator.clipboard.writeText(tempPassword); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                data-testid="button-copy-temp-password"
              >
                {copiedPassword ? <Check className="w-4 h-4 text-chart-2" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The member will be required to set a new password on their next login.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createdPasswordOpen} onOpenChange={setCreatedPasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-chart-2" />
              Member Created Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{createdMemberName}</span> has been created. Share the login credentials with the member.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
              <code className="flex-1 text-sm font-mono font-medium" data-testid="text-created-password">{tempPassword}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => { navigator.clipboard.writeText(tempPassword); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                data-testid="button-copy-created-password"
              >
                {copiedPassword ? <Check className="w-4 h-4 text-chart-2" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The member will be required to change this password on their first login.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
