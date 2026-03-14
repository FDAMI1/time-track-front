import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Clock, Shield, Palette, Eye, EyeOff, Globe, MessageCircle, Plus, Pencil, Trash2, Users, UserPlus, Lock, Timer, CalendarOff } from "lucide-react";

const defaultTheme = {
  appName: "Unified Governance",
  primaryColor: "#2563eb",
  sidebarColor: "#1e293b",
  accentColor: "#3b82f6",
  logoText: "UG",
};

const commonTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
];

const emptySession = {
  name: "",
  startTime: "09:00",
  endTime: "17:00",
  attendanceCutoffTime: "17:00",
  lateThreshold: "09:15",
  autoApprovalTime: "17:00",
  autoAbsentEnabled: true,
};

export default function SettingsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "superadmin";
  const isOrgAdmin = user?.role === "org_admin";
  const canManagePolicy = ["org_admin", "teacher", "manager"].includes(user?.role || "");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [themeForm, setThemeForm] = useState(() => {
    const saved = localStorage.getItem("app_theme");
    return saved ? { ...defaultTheme, ...JSON.parse(saved) } : defaultTheme;
  });

  const [orgSettings, setOrgSettings] = useState({
    attendancePolicyEnabled: true,
    timezone: "UTC",
  });

  const [whatsappForm, setWhatsappForm] = useState({
    whatsappSenderNumber: "",
    whatsappPresentTemplate: "",
    whatsappAbsentTemplate: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningPolicy, setAssigningPolicy] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [passwordPolicyForm, setPasswordPolicyForm] = useState({
    passwordMinLength: 6,
    passwordRequireUppercase: false,
    passwordRequireNumbers: false,
    passwordRequireSpecialChars: false,
  });

  const [overtimeForm, setOvertimeForm] = useState({
    standardWorkingHours: 8,
    overtimeThreshold: 0,
  });

  const [leavePolicyForm, setLeavePolicyForm] = useState({
    sickLeaveLimit: 10,
    casualLeaveLimit: 10,
    annualLeaveLimit: 20,
    maxConsecutiveDays: 5,
    allowHalfDay: true,
    requireApproval: true,
    allowCarryForward: false,
    carryForwardLimit: 5,
  });

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ["/api/policy"],
    queryFn: async () => {
      const res = await fetch("/api/policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: canManagePolicy,
  });

  const { data: orgSettingsData } = useQuery({
    queryKey: ["/api/policy/org-settings"],
    queryFn: async () => {
      const res = await fetch("/api/policy/org-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: canManagePolicy,
  });

  const { data: orgMembers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: canManagePolicy,
  });

  const { data: passwordPolicyData } = useQuery({
    queryKey: ["/api/organizations/my/password-policy"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/my/password-policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isOrgAdmin,
  });

  const { data: overtimeData } = useQuery({
    queryKey: ["/api/organizations/my/overtime-settings"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/my/overtime-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isOrgAdmin,
  });

  const { data: leavePolicyData } = useQuery({
    queryKey: ["/api/leave-policy"],
    queryFn: async () => {
      const res = await fetch("/api/leave-policy", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isOrgAdmin,
  });

  const updateAssignedMembers = useMutation({
    mutationFn: async ({ id, assignedMembers }: { id: string; assignedMembers: string[] }) => {
      const res = await fetch(`/api/policy/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignedMembers }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setAssignDialogOpen(false);
      setAssigningPolicy(null);
      toast({ title: "Members assigned successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openAssignDialog = (policy: any) => {
    setAssigningPolicy(policy);
    setSelectedMembers(policy.assignedMembers?.map((m: any) => typeof m === "string" ? m : m._id || m) || []);
    setAssignDialogOpen(true);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const assignableMembers = (orgMembers || []).filter((m: any) => m.role !== "org_admin");

  useEffect(() => {
    if (orgSettingsData) {
      setOrgSettings({
        attendancePolicyEnabled: orgSettingsData.attendancePolicyEnabled ?? true,
        timezone: orgSettingsData.timezone || "UTC",
      });
      setWhatsappForm({
        whatsappSenderNumber: orgSettingsData.whatsappSenderNumber || "",
        whatsappPresentTemplate: orgSettingsData.whatsappPresentTemplate || "",
        whatsappAbsentTemplate: orgSettingsData.whatsappAbsentTemplate || "",
      });
    }
  }, [orgSettingsData]);

  useEffect(() => {
    if (passwordPolicyData) {
      setPasswordPolicyForm({
        passwordMinLength: passwordPolicyData.passwordMinLength || 6,
        passwordRequireUppercase: passwordPolicyData.passwordRequireUppercase || false,
        passwordRequireNumbers: passwordPolicyData.passwordRequireNumbers || false,
        passwordRequireSpecialChars: passwordPolicyData.passwordRequireSpecialChars || false,
      });
    }
  }, [passwordPolicyData]);

  useEffect(() => {
    if (overtimeData) {
      setOvertimeForm({
        standardWorkingHours: overtimeData.standardWorkingHours || 8,
        overtimeThreshold: overtimeData.overtimeThreshold || 0,
      });
    }
  }, [overtimeData]);

  useEffect(() => {
    if (leavePolicyData) {
      setLeavePolicyForm({
        sickLeaveLimit: leavePolicyData.sickLeaveLimit ?? 10,
        casualLeaveLimit: leavePolicyData.casualLeaveLimit ?? 10,
        annualLeaveLimit: leavePolicyData.annualLeaveLimit ?? 20,
        maxConsecutiveDays: leavePolicyData.maxConsecutiveDays ?? 5,
        allowHalfDay: leavePolicyData.allowHalfDay ?? true,
        requireApproval: leavePolicyData.requireApproval ?? true,
        allowCarryForward: leavePolicyData.allowCarryForward ?? false,
        carryForwardLimit: leavePolicyData.carryForwardLimit ?? 5,
      });
    }
  }, [leavePolicyData]);

  const updateOrgSettings = useMutation({
    mutationFn: async (data: typeof orgSettings) => {
      const res = await fetch("/api/policy/org-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy/org-settings"] });
      toast({ title: "Organization settings updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    },
  });

  const createSession = useMutation({
    mutationFn: async (data: typeof sessionForm) => {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setSessionDialogOpen(false);
      setSessionForm(emptySession);
      toast({ title: "Session created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof sessionForm }) => {
      const res = await fetch(`/api/policy/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setSessionDialogOpen(false);
      setEditingSession(null);
      setSessionForm(emptySession);
      toast({ title: "Session updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/policy/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      setDeleteConfirmId(null);
      toast({ title: "Session deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete session", variant: "destructive" });
    },
  });

  const savePasswordPolicy = useMutation({
    mutationFn: async (data: typeof passwordPolicyForm) => {
      const res = await fetch("/api/organizations/my/password-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my/password-policy"] });
      toast({ title: "Password policy updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update password policy", variant: "destructive" });
    },
  });

  const saveOvertimeSettings = useMutation({
    mutationFn: async (data: typeof overtimeForm) => {
      const res = await fetch("/api/organizations/my/overtime-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my/overtime-settings"] });
      toast({ title: "Overtime settings updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update overtime settings", variant: "destructive" });
    },
  });

  const saveLeavePolicy = useMutation({
    mutationFn: async (data: typeof leavePolicyForm) => {
      const res = await fetch("/api/leave-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-policy"] });
      toast({ title: "Leave policy updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update leave policy", variant: "destructive" });
    },
  });

  const saveWhatsappConfig = useMutation({
    mutationFn: async (data: typeof whatsappForm) => {
      const res = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy/org-settings"] });
      toast({ title: "WhatsApp configuration saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save WhatsApp config", variant: "destructive" });
    },
  });

  const changePassword = useMutation({
    mutationFn: async (data: typeof passwordForm) => {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast({ title: "Password updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    changePassword.mutate(passwordForm);
  };

  const saveTheme = () => {
    localStorage.setItem("app_theme", JSON.stringify(themeForm));
    document.documentElement.style.setProperty("--theme-primary", themeForm.primaryColor);
    document.documentElement.style.setProperty("--theme-sidebar", themeForm.sidebarColor);
    document.documentElement.style.setProperty("--theme-accent", themeForm.accentColor);
    toast({ title: "Theme settings saved" });
  };

  const resetTheme = () => {
    setThemeForm(defaultTheme);
    localStorage.removeItem("app_theme");
    document.documentElement.style.removeProperty("--theme-primary");
    document.documentElement.style.removeProperty("--theme-sidebar");
    document.documentElement.style.removeProperty("--theme-accent");
    toast({ title: "Theme reset to defaults" });
  };

  const openNewSession = () => {
    setEditingSession(null);
    setSessionForm(emptySession);
    setSessionDialogOpen(true);
  };

  const openEditSession = (policy: any) => {
    setEditingSession(policy);
    setSessionForm({
      name: policy.name || "",
      startTime: policy.startTime || "09:00",
      endTime: policy.endTime || "17:00",
      attendanceCutoffTime: policy.attendanceCutoffTime || "17:00",
      lateThreshold: policy.lateThreshold || "09:15",
      autoApprovalTime: policy.autoApprovalTime || "17:00",
      autoAbsentEnabled: policy.autoAbsentEnabled ?? true,
    });
    setSessionDialogOpen(true);
  };

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name.trim()) {
      toast({ title: "Error", description: "Session name is required", variant: "destructive" });
      return;
    }
    if (editingSession) {
      updateSession.mutate({ id: editingSession._id, data: sessionForm });
    } else {
      createSession.mutate(sessionForm);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin ? "Customize platform appearance and manage your account" : "Configure attendance policies and account settings"}
        </p>
      </div>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Platform Customization
            </CardTitle>
            <CardDescription>Customize the look and feel of the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Application Name</Label>
                <Input data-testid="input-app-name" value={themeForm.appName} onChange={(e) => setThemeForm({ ...themeForm, appName: e.target.value })} />
              </div>
              <div>
                <Label>Logo Text (Initials)</Label>
                <Input data-testid="input-logo-text" value={themeForm.logoText} onChange={(e) => setThemeForm({ ...themeForm, logoText: e.target.value })} maxLength={3} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="color" value={themeForm.primaryColor} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" data-testid="input-primary-color" />
                  <Input value={themeForm.primaryColor} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Sidebar Color</Label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="color" value={themeForm.sidebarColor} onChange={(e) => setThemeForm({ ...themeForm, sidebarColor: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" data-testid="input-sidebar-color" />
                  <Input value={themeForm.sidebarColor} onChange={(e) => setThemeForm({ ...themeForm, sidebarColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Accent Color</Label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="color" value={themeForm.accentColor} onChange={(e) => setThemeForm({ ...themeForm, accentColor: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" data-testid="input-accent-color" />
                  <Input value={themeForm.accentColor} onChange={(e) => setThemeForm({ ...themeForm, accentColor: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="flex items-center gap-3 p-3 rounded-md" style={{ backgroundColor: themeForm.sidebarColor }}>
                <div className="w-9 h-9 rounded-md flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: themeForm.primaryColor }}>
                  {themeForm.logoText}
                </div>
                <span className="text-white text-sm font-semibold">{themeForm.appName}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveTheme} data-testid="button-save-theme">Save Theme</Button>
              <Button variant="outline" onClick={resetTheme} data-testid="button-reset-theme">Reset to Defaults</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManagePolicy && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Organization Settings
              </CardTitle>
              <CardDescription>Shared settings that apply across all attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 p-4 rounded-md border bg-card">
                    <div>
                      <p className="text-sm font-medium">Attendance Policy</p>
                      <p className="text-xs text-muted-foreground">
                        {orgSettings.attendancePolicyEnabled
                          ? "Policy is active — attendance rules are enforced"
                          : "Policy is disabled — members cannot mark attendance"}
                      </p>
                    </div>
                    <Switch
                      checked={orgSettings.attendancePolicyEnabled}
                      onCheckedChange={(v) => {
                        const updated = { ...orgSettings, attendancePolicyEnabled: v };
                        setOrgSettings(updated);
                        updateOrgSettings.mutate(updated);
                      }}
                      data-testid="switch-policy-enabled"
                    />
                  </div>

                  {isOrgAdmin && (
                    <div>
                      <Label className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Organization Timezone
                      </Label>
                      <Select
                        value={orgSettings.timezone}
                        onValueChange={(v) => {
                          const updated = { ...orgSettings, timezone: v };
                          setOrgSettings(updated);
                          updateOrgSettings.mutate(updated);
                        }}
                      >
                        <SelectTrigger className="w-full mt-1" data-testid="select-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {commonTimezones.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Attendance marking will follow this timezone</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Attendance Sessions
                  </CardTitle>
                  <CardDescription>Define time slots/sessions for attendance tracking</CardDescription>
                </div>
                <Button size="sm" onClick={openNewSession} data-testid="button-add-session">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Session
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !policies || policies.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-3">No attendance sessions configured</p>
                  <Button onClick={openNewSession} data-testid="button-add-first-session">
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {policies.map((p: any) => (
                    <div
                      key={p._id}
                      className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card"
                      data-testid={`card-session-${p._id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm" data-testid={`text-session-name-${p._id}`}>{p.name}</p>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {p.startTime} — {p.endTime}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Late after: {p.lateThreshold}</span>
                          <span>Cutoff: {p.attendanceCutoffTime}</span>
                          <span>Auto-approval: {p.autoApprovalTime}</span>
                          <span>Auto-absent: {p.autoAbsentEnabled ? "On" : "Off"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openAssignDialog(p)}
                            data-testid={`button-assign-members-${p._id}`}
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" />
                            Assign Members
                          </Button>
                          {p.assignedMembers && p.assignedMembers.length > 0 ? (
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-assigned-count-${p._id}`}>
                              <Users className="w-3 h-3 mr-1" />
                              {p.assignedMembers.length} assigned
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">All members (no filter)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditSession(p)}
                          data-testid={`button-edit-session-${p._id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(p._id)}
                          data-testid={`button-delete-session-${p._id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              WhatsApp Configuration
            </CardTitle>
            <CardDescription>
              Configure the official WhatsApp number for sending attendance notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); saveWhatsappConfig.mutate(whatsappForm); }}
              className="space-y-4"
            >
              <div>
                <Label>Official WhatsApp Sender Number</Label>
                <Input
                  type="tel"
                  data-testid="input-whatsapp-sender"
                  value={whatsappForm.whatsappSenderNumber}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, whatsappSenderNumber: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is the organization's WhatsApp number from which notifications will be sent
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  Present Template
                </Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="input-whatsapp-present-template"
                  value={whatsappForm.whatsappPresentTemplate}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, whatsappPresentTemplate: e.target.value })}
                  placeholder="Leave empty for default. E.g: Hi {name}, your attendance at {org} on {date} has been marked as {status}."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Message sent when attendance is marked as Present/Late/Pending
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  Absent Template
                </Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="input-whatsapp-absent-template"
                  value={whatsappForm.whatsappAbsentTemplate}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, whatsappAbsentTemplate: e.target.value })}
                  placeholder="Leave empty for default. E.g: Hi {name}, you were marked Absent at {org} on {date}. Please contact your admin."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Message sent when attendance is marked as Absent
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Available placeholders: {"{name}"}, {"{status}"}, {"{date}"}, {"{time}"}, {"{org}"}
              </p>

              <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">How it works</p>
                <ul className="text-xs text-green-600 dark:text-green-500 space-y-1">
                  <li>• When a student marks attendance, a notification is automatically created</li>
                  <li>• Go to the WhatsApp page in the sidebar to view and send pending notifications</li>
                  <li>• Click "Send" to open WhatsApp with the pre-composed message</li>
                  <li>• Notifications are sent to both student and parent WhatsApp numbers</li>
                </ul>
              </div>

              <Button type="submit" disabled={saveWhatsappConfig.isPending} data-testid="button-save-whatsapp">
                {saveWhatsappConfig.isPending ? "Saving..." : "Save WhatsApp Config"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Password Policy
            </CardTitle>
            <CardDescription>Set password requirements for your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); savePasswordPolicy.mutate(passwordPolicyForm); }} className="space-y-4 max-w-md">
              <div>
                <Label>Minimum Password Length</Label>
                <Input
                  type="number"
                  min={6}
                  max={32}
                  data-testid="input-password-min-length"
                  value={passwordPolicyForm.passwordMinLength}
                  onChange={(e) => setPasswordPolicyForm({ ...passwordPolicyForm, passwordMinLength: parseInt(e.target.value) || 6 })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div>
                  <p className="text-sm font-medium">Require Uppercase Letter</p>
                  <p className="text-xs text-muted-foreground">At least one uppercase letter (A-Z)</p>
                </div>
                <Switch
                  checked={passwordPolicyForm.passwordRequireUppercase}
                  onCheckedChange={(v) => setPasswordPolicyForm({ ...passwordPolicyForm, passwordRequireUppercase: v })}
                  data-testid="switch-require-uppercase"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div>
                  <p className="text-sm font-medium">Require Numbers</p>
                  <p className="text-xs text-muted-foreground">At least one number (0-9)</p>
                </div>
                <Switch
                  checked={passwordPolicyForm.passwordRequireNumbers}
                  onCheckedChange={(v) => setPasswordPolicyForm({ ...passwordPolicyForm, passwordRequireNumbers: v })}
                  data-testid="switch-require-numbers"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div>
                  <p className="text-sm font-medium">Require Special Characters</p>
                  <p className="text-xs text-muted-foreground">At least one special character (!@#$%^&*)</p>
                </div>
                <Switch
                  checked={passwordPolicyForm.passwordRequireSpecialChars}
                  onCheckedChange={(v) => setPasswordPolicyForm({ ...passwordPolicyForm, passwordRequireSpecialChars: v })}
                  data-testid="switch-require-special"
                />
              </div>
              <Button type="submit" disabled={savePasswordPolicy.isPending} data-testid="button-save-password-policy">
                {savePasswordPolicy.isPending ? "Saving..." : "Save Password Policy"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Overtime Settings
            </CardTitle>
            <CardDescription>Configure overtime calculation parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveOvertimeSettings.mutate(overtimeForm); }} className="space-y-4 max-w-md">
              <div>
                <Label>Standard Working Hours (per day)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  data-testid="input-standard-hours"
                  value={overtimeForm.standardWorkingHours}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, standardWorkingHours: parseFloat(e.target.value) || 8 })}
                />
                <p className="text-xs text-muted-foreground mt-1">Hours worked beyond this are considered overtime</p>
              </div>
              <div>
                <Label>Overtime Threshold (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  data-testid="input-overtime-threshold"
                  value={overtimeForm.overtimeThreshold}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, overtimeThreshold: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum extra minutes after standard hours before overtime counts (0 = immediate)</p>
              </div>
              <Button type="submit" disabled={saveOvertimeSettings.isPending} data-testid="button-save-overtime">
                {saveOvertimeSettings.isPending ? "Saving..." : "Save Overtime Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarOff className="w-5 h-5" />
              Leave Policy
            </CardTitle>
            <CardDescription>Configure leave limits and rules for your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveLeavePolicy.mutate(leavePolicyForm); }} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Sick Leave Limit</Label>
                  <Input
                    type="number"
                    min={0}
                    data-testid="input-sick-leave-limit"
                    value={leavePolicyForm.sickLeaveLimit}
                    onChange={(e) => setLeavePolicyForm({ ...leavePolicyForm, sickLeaveLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Casual Leave Limit</Label>
                  <Input
                    type="number"
                    min={0}
                    data-testid="input-casual-leave-limit"
                    value={leavePolicyForm.casualLeaveLimit}
                    onChange={(e) => setLeavePolicyForm({ ...leavePolicyForm, casualLeaveLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Annual Leave Limit</Label>
                  <Input
                    type="number"
                    min={0}
                    data-testid="input-annual-leave-limit"
                    value={leavePolicyForm.annualLeaveLimit}
                    onChange={(e) => setLeavePolicyForm({ ...leavePolicyForm, annualLeaveLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Max Consecutive Days</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  data-testid="input-max-consecutive"
                  value={leavePolicyForm.maxConsecutiveDays}
                  onChange={(e) => setLeavePolicyForm({ ...leavePolicyForm, maxConsecutiveDays: parseInt(e.target.value) || 5 })}
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum number of consecutive leave days allowed</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <div>
                    <p className="text-sm font-medium">Allow Half-Day Leave</p>
                    <p className="text-xs text-muted-foreground">Members can request morning or afternoon half-day</p>
                  </div>
                  <Switch
                    checked={leavePolicyForm.allowHalfDay}
                    onCheckedChange={(v) => setLeavePolicyForm({ ...leavePolicyForm, allowHalfDay: v })}
                    data-testid="switch-allow-half-day"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <div>
                    <p className="text-sm font-medium">Require Approval</p>
                    <p className="text-xs text-muted-foreground">Leave requests need manager/admin approval</p>
                  </div>
                  <Switch
                    checked={leavePolicyForm.requireApproval}
                    onCheckedChange={(v) => setLeavePolicyForm({ ...leavePolicyForm, requireApproval: v })}
                    data-testid="switch-require-approval"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <div>
                    <p className="text-sm font-medium">Allow Carry Forward</p>
                    <p className="text-xs text-muted-foreground">Unused leaves carry over to next year</p>
                  </div>
                  <Switch
                    checked={leavePolicyForm.allowCarryForward}
                    onCheckedChange={(v) => setLeavePolicyForm({ ...leavePolicyForm, allowCarryForward: v })}
                    data-testid="switch-carry-forward"
                  />
                </div>
                {leavePolicyForm.allowCarryForward && (
                  <div className="pl-4">
                    <Label>Carry Forward Limit (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      data-testid="input-carry-forward-limit"
                      value={leavePolicyForm.carryForwardLimit}
                      onChange={(e) => setLeavePolicyForm({ ...leavePolicyForm, carryForwardLimit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
              <Button type="submit" disabled={saveLeavePolicy.isPending} data-testid="button-save-leave-policy">
                {saveLeavePolicy.isPending ? "Saving..." : "Save Leave Policy"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            {!["org_admin", "super_admin"].includes(user?.role || "") && (
            <div>
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  data-testid="input-current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            )}
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  data-testid="input-new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  data-testid="input-confirm-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={changePassword.isPending} data-testid="button-change-password">
              {changePassword.isPending ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "New Attendance Session"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSessionSubmit} className="space-y-4">
            <div>
              <Label>Session Name</Label>
              <Input
                data-testid="input-session-name"
                value={sessionForm.name}
                onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                placeholder="e.g. Morning Session, Afternoon Class"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  data-testid="input-session-start"
                  value={sessionForm.startTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  data-testid="input-session-end"
                  value={sessionForm.endTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Late Threshold</Label>
                <Input
                  type="time"
                  data-testid="input-session-late"
                  value={sessionForm.lateThreshold}
                  onChange={(e) => setSessionForm({ ...sessionForm, lateThreshold: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">After this, marked late</p>
              </div>
              <div>
                <Label>Cutoff Time</Label>
                <Input
                  type="time"
                  data-testid="input-session-cutoff"
                  value={sessionForm.attendanceCutoffTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, attendanceCutoffTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">After this, can't mark</p>
              </div>
            </div>
            <div>
              <Label>Auto Approval Time</Label>
              <Input
                type="time"
                data-testid="input-session-auto-approval"
                value={sessionForm.autoApprovalTime}
                onChange={(e) => setSessionForm({ ...sessionForm, autoApprovalTime: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30">
              <div>
                <p className="text-sm font-medium">Auto Absent</p>
                <p className="text-xs text-muted-foreground">Auto-mark absent if not marked by cutoff</p>
              </div>
              <Switch
                checked={sessionForm.autoAbsentEnabled}
                onCheckedChange={(v) => setSessionForm({ ...sessionForm, autoAbsentEnabled: v })}
                data-testid="switch-session-auto-absent"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSessionDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createSession.isPending || updateSession.isPending}
                data-testid="button-save-session"
              >
                {(createSession.isPending || updateSession.isPending) ? "Saving..." : editingSession ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this attendance session? Existing attendance records for this session will be preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteSession.mutate(deleteConfirmId)}
              disabled={deleteSession.isPending}
              data-testid="button-confirm-delete-session"
            >
              {deleteSession.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={(open) => { if (!open) { setAssignDialogOpen(false); setAssigningPolicy(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assign Members — {assigningPolicy?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select the members who should appear for attendance in this session. If none are selected, all members will be shown.
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{selectedMembers.length} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setSelectedMembers(assignableMembers.map((m: any) => m._id))}
                data-testid="button-select-all-members"
              >
                Select All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setSelectedMembers([])}
                data-testid="button-clear-all-members"
              >
                Clear All
              </Button>
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
            {assignableMembers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No members found</p>
            ) : (
              assignableMembers.map((m: any) => (
                <label
                  key={m._id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                  data-testid={`label-member-${m._id}`}
                >
                  <Checkbox
                    checked={selectedMembers.includes(m._id)}
                    onCheckedChange={() => toggleMember(m._id)}
                    data-testid={`checkbox-member-${m._id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{m.firstName} {m.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-2">@{m.username}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{m.role}</Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialogOpen(false); setAssigningPolicy(null); }}>Cancel</Button>
            <Button
              onClick={() => assigningPolicy && updateAssignedMembers.mutate({ id: assigningPolicy._id, assignedMembers: selectedMembers })}
              disabled={updateAssignedMembers.isPending}
              data-testid="button-save-assignments"
            >
              {updateAssignedMembers.isPending ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
