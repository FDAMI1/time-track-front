import { apiFetch } from "@/lib/api";
import { getInitials } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RemoteImage } from "@/components/remote-image";
import { Building2, Plus, GraduationCap, Briefcase, Users, Globe, Phone, MapPin, Eye, Pencil, Trash2, EyeIcon, EyeOff, LogIn, Upload } from "lucide-react";

// What the superadmin can switch on or off for one organization. Each organization's
// tickets and CRM are its own; the superadmin only decides whether it has them.
const ORG_FEATURES: { key: string; label: string; academyOnly?: boolean }[] = [
  { key: "tickets", label: "Tickets" }, { key: "crm", label: "CRM (Leads)" }, { key: "assistant", label: "AI Assistant" },
  { key: "attendance", label: "Attendance" }, { key: "leaves", label: "Leaves" }, { key: "timeTracking", label: "Time Tracking" },
  { key: "tasks", label: "Tasks" }, { key: "projects", label: "Projects" }, { key: "departments", label: "Departments" }, { key: "chat", label: "Chat" },
  { key: "classes", label: "Classes", academyOnly: true }, { key: "assignments", label: "Assignments", academyOnly: true },
  { key: "admissions", label: "Admissions", academyOnly: true }, { key: "fees", label: "Fees", academyOnly: true }, { key: "lectures", label: "Lectures", academyOnly: true },
  { key: "mcq", label: "MCQ Tests", academyOnly: true },
];
const featuresFor = (type: string) => ORG_FEATURES.filter((f) => !f.academyOnly || type === "academy");
const allFeatures = (on: boolean) => Object.fromEntries(ORG_FEATURES.map((f) => [f.key, on]));
const EMPTY_FORM = {
  name: "", type: "academy", address: "", phone: "", domain: "",
  adminFirstName: "", adminLastName: "", adminEmail: "", adminUsername: "", adminPassword: "",
  features: allFeatures(true),
};

// The organization's own logo. Every member of that organization sees it in the sidebar,
// the top bar and the browser tab; no other organization changes.
function OrgBranding({ org, token }: { org: { _id: string; name: string; branding?: { logoUrl?: string; logoType?: string } }; token: string | null }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const change = useMutation({
    mutationFn: async (next: File | null) => {
      const init: RequestInit = { method: next ? "POST" : "DELETE", headers: { Authorization: `Bearer ${token}` } };
      if (next) { const body = new FormData(); body.append("logo", next); init.body = body; }
      const res = await apiFetch(`/api/organizations/${org._id}/logo`, init);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Logo not saved");
      return next;
    },
    onSuccess: (next) => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", org._id] });
      toast({ title: next ? "Logo saved" : "Logo removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const logo = org.branding?.logoType === "image" ? org.branding.logoUrl : "";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden" data-testid="org-logo-preview">
          <RemoteImage src={preview || logo || ""} alt={`${org.name} logo`} className="max-w-full max-h-full object-contain" fallback={<span className="text-xs text-muted-foreground text-center px-2">Default branding</span>} />
        </div>
        <div className="space-y-2">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} data-testid="input-org-logo" />
          {file ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={change.isPending} onClick={() => change.mutate(file)} data-testid="button-save-org-logo">
                {change.isPending ? "Saving..." : "Save Logo"}
              </Button>
              <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => setFile(null)} data-testid="button-cancel-org-logo">Cancel</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={change.isPending} onClick={() => input.current?.click()} data-testid="button-upload-org-logo">
                <Upload className="w-3.5 h-3.5 mr-1" />{logo ? "Replace Logo" : "Upload Organisation Logo"}
              </Button>
              {logo && (
                <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate(null)} data-testid="button-remove-org-logo">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Remove
                </Button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{file ? "Preview: not saved yet." : "PNG or JPG, up to 2 MB. A square logo looks best."}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Shown to everyone in {org.name} in the sidebar, the top bar and the browser tab. Without a logo they see the default branding.</p>
    </div>
  );
}

export default function OrganizationsPage() {
  const { token, impersonate } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ name: "", domain: "", phone: "", address: "" });

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiFetch("/api/organizations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: orgDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["/api/organizations", selectedOrg?._id],
    queryFn: async () => {
      const res = await apiFetch(`/api/organizations/${selectedOrg._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedOrg?._id && viewOpen,
  });

  const createOrg = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiFetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Only the switches shown for this type are sent; the rest keep their defaults.
        body: JSON.stringify({ ...data, features: Object.fromEntries(featuresFor(data.type).map((f) => [f.key, data.features[f.key]])) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/superadmin"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setShowAdminPassword(false);
      toast({ title: "Organization created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateOrg = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiFetch(`/api/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setEditOpen(false);
      toast({ title: "Organization updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    },
  });

  const deleteOrg = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/organizations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/superadmin"] });
      toast({ title: "Organization permanently deleted" });
    },
  });

  const openView = (org: any) => {
    setSelectedOrg(org);
    setViewOpen(true);
  };

  const openEdit = (org: any) => {
    setEditForm({ name: org.name, domain: org.domain || "", phone: org.phone || "", address: org.address || "" });
    setSelectedOrg(org);
    setEditOpen(true);
  };

  const [impersonating, setImpersonating] = useState(false);

  const handleViewAsAdmin = async (orgUsers: any[]) => {
    const admin = orgUsers.find((u: any) => u.role === "org_admin" && u.isActive);
    if (!admin) {
      toast({ title: "Error", description: "No active admin found for this organization", variant: "destructive" });
      return;
    }
    setImpersonating(true);
    try {
      await impersonate(admin._id);
      setViewOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImpersonating(false);
    }
  };

  const roleLabels: Record<string, string> = {
    org_admin: "Admin", teacher: "Teacher", student: "Student", manager: "Manager", employee: "Employee",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orgs-title">Organizations</h1>
          <p className="text-muted-foreground">Manage all organizations on the platform</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-org">
              <Plus className="w-4 h-4 mr-2" />
              New Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createOrg.mutate(form); }} className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Organization Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Organization Name</Label>
                    <Input data-testid="input-org-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger data-testid="select-org-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="academy">Academy</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Domain Name</Label><Input data-testid="input-org-domain" placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Features</p>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, features: allFeatures(true) })} data-testid="button-features-all">All</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, features: allFeatures(false) })} data-testid="button-features-none">None</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="create-org-features">
                  {featuresFor(form.type).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <Label htmlFor={`new-feature-${key}`} className="text-sm font-normal">{label}</Label>
                      <Switch id={`new-feature-${key}`} checked={form.features[key]} onCheckedChange={(on) => setForm({ ...form, features: { ...form.features, [key]: on } })} data-testid={`switch-new-feature-${key}`} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Features switched off here are locked: the organization's admin can't turn them on.</p>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground">Admin Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input data-testid="input-admin-first" value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} required /></div>
                  <div><Label>Last Name</Label><Input data-testid="input-admin-last" value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} required /></div>
                  <div><Label>Admin Email</Label><Input type="email" data-testid="input-admin-email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required /></div>
                  <div><Label>Username</Label><Input data-testid="input-admin-username" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required /></div>
                  <div className="col-span-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input type={showAdminPassword ? "text" : "password"} data-testid="input-admin-password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required minLength={6} className="pr-10" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowAdminPassword(!showAdminPassword)} data-testid="button-toggle-admin-password">
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createOrg.isPending} data-testid="button-submit-org">
                {createOrg.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(orgs || []).map((org: any) => (
            <Card key={org._id} className="hover-elevate transition-all" data-testid={`card-org-${org._id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-md flex items-center justify-center ${org.type === "academy" ? "bg-chart-4/10" : "bg-chart-1/10"}`}>
                      {org.type === "academy" ? (
                        <GraduationCap className="w-5 h-5 text-chart-4" />
                      ) : (
                        <Briefcase className="w-5 h-5 text-chart-1" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{org.name}</h3>
                      <Badge variant="secondary" className="capitalize text-xs mt-0.5">{org.type}</Badge>
                    </div>
                  </div>
                  <Badge variant={org.isActive ? "default" : "secondary"}>
                    {org.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {org.domain && (
                    <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" />{org.domain}</div>
                  )}
                  {org.phone && (
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{org.phone}</div>
                  )}
                  {org.address && (
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{org.address}</div>
                  )}
                  <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />{org.userCount || 0} members</div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => openView(org)} data-testid={`button-view-org-${org._id}`}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(org)} data-testid={`button-edit-org-${org._id}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={() => { if (confirm("Permanently delete this organization and ALL its data? This cannot be undone.")) deleteOrg.mutate(org._id); }} data-testid={`button-delete-org-${org._id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!orgs || orgs.length === 0) && (
            <div className="col-span-full text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No organizations yet. Create your first one.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedOrg?.type === "academy" ? <GraduationCap className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
              {selectedOrg?.name}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : orgDetail ? (
            <Tabs defaultValue="overview">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="overview" data-testid="tab-org-overview">Overview</TabsTrigger>
                <TabsTrigger value="branding" data-testid="tab-org-branding">Branding</TabsTrigger>
              </TabsList>
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <span className="capitalize font-medium">{orgDetail.type}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={orgDetail.isActive ? "default" : "secondary"}>{orgDetail.isActive ? "Active" : "Inactive"}</Badge></div>
                {orgDetail.domain && <div><span className="text-muted-foreground">Domain:</span> <span className="font-medium">{orgDetail.domain}</span></div>}
                {orgDetail.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{orgDetail.phone}</span></div>}
                {orgDetail.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{orgDetail.address}</span></div>}
                <div><span className="text-muted-foreground">Members:</span> <span className="font-medium">{orgDetail.userCount}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{new Date(orgDetail.createdAt).toLocaleDateString()}</span></div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="org-features">
                  {ORG_FEATURES.filter((f) => !f.academyOnly || orgDetail.type === "academy").map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <Label htmlFor={`feature-${key}`}>{label}</Label>
                      <Switch id={`feature-${key}`} checked={orgDetail.features?.[key] !== false} disabled={updateOrg.isPending} onCheckedChange={(enabled) => updateOrg.mutate({ id: orgDetail._id, data: { features: { [key]: enabled } } })} data-testid={`switch-org-feature-${key}`} />
                    </div>
                  ))}
                </div>
              </div>

              {orgDetail.users && orgDetail.users.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Members ({orgDetail.users.length})</h3>
                    <Button
                      size="sm"
                      onClick={() => handleViewAsAdmin(orgDetail.users)}
                      disabled={impersonating}
                      data-testid="button-view-as-admin"
                    >
                      <LogIn className="w-3.5 h-3.5 mr-1" />
                      {impersonating ? "Switching..." : "View as Admin"}
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgDetail.users.map((u: any) => (
                        <TableRow key={u._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(u.firstName, u.lastName)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{u.firstName} {u.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.username}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs capitalize">{roleLabels[u.role] || u.role}</Badge></TableCell>
                          <TableCell><Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="branding" className="mt-4">
              <OrgBranding org={orgDetail} token={token} />
            </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (selectedOrg) updateOrg.mutate({ id: selectedOrg._id, data: editForm }); }} className="space-y-4">
            <div><Label>Organization Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required data-testid="input-edit-org-name" /></div>
            <div><Label>Domain Name</Label><Input value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} placeholder="example.com" data-testid="input-edit-org-domain" /></div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} data-testid="input-edit-org-phone" /></div>
            <div><Label>Address</Label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} data-testid="input-edit-org-address" /></div>
            <Button type="submit" className="w-full" disabled={updateOrg.isPending} data-testid="button-submit-edit-org">
              {updateOrg.isPending ? "Updating..." : "Update Organization"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
