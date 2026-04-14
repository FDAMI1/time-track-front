import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Users, Pencil, Trash2, Eye, EyeOff, Phone, GraduationCap, MessageCircle, Clock, KeyRound, Copy, Check } from "lucide-react";

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
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [tempPwdState, setTempPwdState] = useState<{ open: boolean; password: string; username: string }>({ open: false, password: "", username: "" });
  const [resetPwdState, setResetPwdState] = useState<{ open: boolean; password: string; username: string }>({ open: false, password: "", username: "" });
  const [copiedTemp, setCopiedTemp] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const orgType = user?.organizationId?.type;

  const availableRoles = orgType === "academy"
    ? [{ value: "teacher", label: "Teacher" }, { value: "student", label: "Student" }]
    : orgType === "company"
    ? [{ value: "manager", label: "Manager" }, { value: "employee", label: "Employee" }]
    : [{ value: "teacher", label: "Teacher" }, { value: "student", label: "Student" }, { value: "manager", label: "Manager" }, { value: "employee", label: "Employee" }];

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", emailDomain: "", phone: "", education: "", username: "", userId: "",
    role: availableRoles[0]?.value || "employee",
    studentWhatsapp: "", parentWhatsapp: "",
    assignedSchedules: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", education: "", role: "", password: "", userId: "",
    studentWhatsapp: "", parentWhatsapp: "",
    assignedSchedules: [] as string[],
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiFetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: policies } = useQuery({
    queryKey: ["/api/policy"],
    queryFn: async () => {
      const res = await apiFetch("/api/policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: orgDomains } = useQuery({
    queryKey: ["/api/organizations/my/domains"],
    queryFn: async () => {
      const res = await apiFetch("/api/organizations/my/domains", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { allowedEmailDomains: [] };
      return res.json();
    },
    enabled: !!token,
  });
  const domains: string[] = orgDomains?.allowedEmailDomains || [];

  const createUser = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: any = { ...data };
      if (data.emailDomain && data.username) {
        payload.emailDomain = data.emailDomain;
        delete payload.email;
      }
      const res = await apiFetch("/api/users", {
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
      setForm({ firstName: "", lastName: "", email: "", emailDomain: "", phone: "", education: "", username: "", userId: "", role: availableRoles[0]?.value || "employee", studentWhatsapp: "", parentWhatsapp: "", assignedSchedules: [] });
      setTempPwdState({ open: true, password: data.tempPassword, username: data.user?.username || "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data, id) => {
      const member = (members || []).find((m: any) => m._id === id);
      setResetPwdState({ open: true, password: data.tempPassword, username: member?.username || "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiFetch(`/api/users/${id}`, {
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
      const res = await apiFetch(`/api/users/${id}`, {
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

  const locationOverride = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean | null }) => {
      const res = await apiFetch(`/api/users/${id}/location-override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationRestrictionEnabled: value }),
      });
      if (!res.ok) throw new Error("Failed to update location setting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Location setting updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: teachersList } = useQuery({
    queryKey: ["/api/users", "teachers"],
    queryFn: async () => {
      const res = await apiFetch("/api/users?role=teacher", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: ["superadmin", "org_admin"].includes(user?.role || ""),
  });

  const assignTeacher = useMutation({
    mutationFn: async ({ id, teacherId }: { id: string; teacherId: string | null }) => {
      const res = await apiFetch(`/api/users/${id}/assign-teacher`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacherId }),
      });
      if (!res.ok) throw new Error("Failed to assign teacher");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Teacher assigned" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

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
      userId: member.userId || "",
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
                    WhatsApp Numbers <span className="font-normal text-xs">(optional)</span>
                  </p>
                  <div>
                    <Label>{form.role === "student" ? "Student" : "Employee"} WhatsApp Number</Label>
                    <Input
                      type="tel"
                      data-testid="input-student-whatsapp"
                      value={form.studentWhatsapp}
                      onChange={(e) => setForm({ ...form, studentWhatsapp: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
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
              <div className="space-y-1">
                <Label>Username &amp; Email</Label>
                <div className="flex gap-2">
                  <Input
                    data-testid="input-member-username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                    required
                    className="flex-1"
                  />
                  {domains.length > 0 ? (
                    <Select value={form.emailDomain} onValueChange={(v) => setForm({ ...form, emailDomain: v })}>
                      <SelectTrigger className="w-[185px]" data-testid="select-member-email-domain">
                        <SelectValue placeholder="@domain.com" />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map((d) => (
                          <SelectItem key={d} value={d}>@{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      data-testid="input-member-email-manual"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="@domain.com or full email"
                      className="w-[185px]"
                    />
                  )}
                </div>
                {form.username && form.emailDomain && (
                  <p className="text-xs text-muted-foreground">Email will be: {form.username}@{form.emailDomain}</p>
                )}
                {domains.length === 0 && (
                  <p className="text-xs text-muted-foreground">No domains configured — go to Settings to add email domains.</p>
                )}
              </div>
              <div><Label>User ID <span className="text-muted-foreground text-xs">(optional)</span></Label><Input data-testid="input-member-userid" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="e.g. STU-001 or EMP-042" /></div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" />
                A temporary password will be auto-generated and shown after creation.
              </p>
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
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  {["superadmin", "org_admin"].includes(user?.role || "") && orgType === "academy" && (
                    <TableHead>Teacher</TableHead>
                  )}
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
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                            <button
                              className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                              onClick={() => { navigator.clipboard.writeText(m.email); toast({ title: "Email copied" }); }}
                              data-testid={`button-copy-email-${m._id}`}
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {m.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</p>
                          )}
                          {m.education && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" />{m.education}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>{m.username}</span>
                        <button
                          className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                          onClick={() => { navigator.clipboard.writeText(m.username); toast({ title: "Username copied" }); }}
                          data-testid={`button-copy-username-${m._id}`}
                          title="Copy username"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
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
                      <div className="inline-flex rounded-full border text-xs font-medium overflow-hidden">
                        <span className={`px-2.5 py-1 transition-colors ${m.isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                          Active
                        </span>
                        <span className={`px-2.5 py-1 transition-colors ${!m.isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>
                          Inactive
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageRole(m.role) ? (
                        <Select
                          value={m.locationRestrictionEnabled === null || m.locationRestrictionEnabled === undefined ? "default" : m.locationRestrictionEnabled ? "on" : "off"}
                          onValueChange={(v) => locationOverride.mutate({ id: m._id, value: v === "default" ? null : v === "on" })}
                          data-testid={`select-location-${m._id}`}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs" data-testid={`trigger-location-${m._id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="on">ON</SelectItem>
                            <SelectItem value="off">OFF</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    {["superadmin", "org_admin"].includes(user?.role || "") && orgType === "academy" && (
                      <TableCell>
                        {m.role === "student" ? (
                          <Select
                            value={m.assignedTeacher?._id || m.assignedTeacher || "none"}
                            onValueChange={(v) => assignTeacher.mutate({ id: m._id, teacherId: v === "none" ? null : v })}
                            data-testid={`select-teacher-${m._id}`}
                          >
                            <SelectTrigger className="h-7 w-36 text-xs" data-testid={`trigger-teacher-${m._id}`}>
                              <SelectValue placeholder="Assign teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Unassigned —</SelectItem>
                              {(teachersList || []).map((t: any) => (
                                <SelectItem key={t._id} value={t._id}>{t.firstName} {t.lastName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {canManageRole(m.role) && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} data-testid={`button-edit-member-${m._id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Reset Password" onClick={() => { if (confirm(`Reset password for ${m.firstName} ${m.lastName}?`)) resetPassword.mutate(m._id); }} data-testid={`button-reset-password-${m._id}`} disabled={resetPassword.isPending}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          {["superadmin", "org_admin"].includes(user?.role || "") && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Delete ${m.firstName} ${m.lastName}?`)) deleteUser.mutate(m._id); }} data-testid={`button-delete-member-${m._id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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

      <Dialog open={tempPwdState.open} onOpenChange={(o) => { if (!o) { setTempPwdState({ open: false, password: "", username: "" }); setCopiedTemp(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" />Member Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The account <strong>{tempPwdState.username}</strong> has been created. Share this temporary password with the member — they will be asked to change it on first login.
            </p>
            <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Temporary Password</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold tracking-widest flex-1" data-testid="text-temp-password">{tempPwdState.password}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(tempPwdState.password); setCopiedTemp(true); setTimeout(() => setCopiedTemp(false), 2000); }}
                  data-testid="button-copy-temp-password"
                >
                  {copiedTemp ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copiedTemp ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This password will not be shown again. Make sure to save it.</p>
            <Button className="w-full" onClick={() => { setTempPwdState({ open: false, password: "", username: "" }); setCopiedTemp(false); }} data-testid="button-close-temp-password">Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPwdState.open} onOpenChange={(o) => { if (!o) { setResetPwdState({ open: false, password: "", username: "" }); setCopiedReset(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-600" />Password Reset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Password for <strong>{resetPwdState.username}</strong> has been reset. Share this new temporary password — the member will be required to change it on next login.
            </p>
            <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">New Temporary Password</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold tracking-widest flex-1" data-testid="text-reset-password">{resetPwdState.password}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(resetPwdState.password); setCopiedReset(true); setTimeout(() => setCopiedReset(false), 2000); }}
                  data-testid="button-copy-reset-password"
                >
                  {copiedReset ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copiedReset ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This password will not be shown again. Make sure to save it.</p>
            <Button className="w-full" onClick={() => { setResetPwdState({ open: false, password: "", username: "" }); setCopiedReset(false); }} data-testid="button-close-reset-password">Done</Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div><Label>User ID <span className="text-muted-foreground text-xs">(optional)</span></Label><Input data-testid="input-edit-userid" value={editForm.userId} onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })} placeholder="e.g. STU-001 or EMP-042" /></div>
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
    </div>
  );
}
