import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { apiFetch, safeJson, BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Receipt, Plus, CheckCircle, XCircle, ArrowRight, IndianRupee, Settings2, Trash2 } from "lucide-react";

const CLAIM_TYPES = ["travel", "mobile", "food", "accommodation", "equipment", "medical", "other"];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending_manager: { label: "Pending Manager", className: "bg-amber-100 text-amber-800" },
  approved_manager: { label: "Approved by Manager", className: "bg-blue-100 text-blue-800" },
  forwarded: { label: "Forwarded", className: "bg-purple-100 text-purple-800" },
  approved_final: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export default function ReimbursementsPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const [rejectReason, setRejectReason] = useState("");
  const [forwardDialog, setForwardDialog] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const [forwardTargetId, setForwardTargetId] = useState("");
  const [form, setForm] = useState({ type: "", amount: "", description: "" });
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [policyForm, setPolicyForm] = useState({ type: "", minAmount: "0", maxAmount: "" });

  const orgType = (user?.organizationId as any)?.type;
  const isAdmin = user?.role === "org_admin";

  const { data: claims = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reimbursements"],
    enabled: orgType === "company",
  });

  const { data: policies = [] } = useQuery<any[]>({
    queryKey: ["/api/reimbursements/policies"],
    enabled: orgType === "company",
  });

  // Load users for manager select and forward dialog
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: orgType === "company",
  });
  const managers = (allUsers as any[]).filter((u: any) =>
    ["manager", "org_admin"].includes(u.role)
  );

  const activePolicy = (policies as any[]).find((p: any) => p.type === form.type) || null;
  const amountNum = Number(form.amount);
  const amountError =
    activePolicy && form.amount
      ? amountNum < activePolicy.minAmount || amountNum > activePolicy.maxAmount
        ? `Amount must be between ₹${activePolicy.minAmount.toLocaleString()} and ₹${activePolicy.maxAmount.toLocaleString()}`
        : null
      : null;

  const createClaim = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("type", form.type);
      formData.append("amount", String(form.amount));
      formData.append("description", form.description);
      if (selectedManagerId) formData.append("managerId", selectedManagerId);
      if (invoiceFile) formData.append("invoice", invoiceFile);
      const res = await apiFetch("/api/reimbursements", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const e = await safeJson(res);
        throw new Error(e?.message || "Failed to submit");
      }
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setForm({ type: "", amount: "", description: "" });
      setSelectedManagerId("");
      setInvoiceFile(null);
      setShowForm(false);
      toast({ title: "Claim submitted successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const takeAction = useMutation({
    mutationFn: async ({
      id,
      action,
      rejectionReason,
      newAssignedTo,
    }: {
      id: string;
      action: string;
      rejectionReason?: string;
      newAssignedTo?: string;
    }) => {
      const res = await apiFetch(`/api/reimbursements/${id}/action`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, rejectionReason, newAssignedTo }),
      });
      if (!res.ok) throw new Error("Action failed");
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setRejectDialog({ id: "", open: false });
      setRejectReason("");
      setForwardDialog({ id: "", open: false });
      setForwardTargetId("");
      toast({ title: "Action completed" });
    },
    onError: () => toast({ title: "Error", description: "Action failed", variant: "destructive" }),
  });

  const savePolicy = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/reimbursements/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: policyForm.type,
          minAmount: Number(policyForm.minAmount) || 0,
          maxAmount: Number(policyForm.maxAmount),
        }),
      });
      if (!res.ok) {
        const e = await safeJson(res);
        throw new Error(e?.message || "Failed to save policy");
      }
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements/policies"] });
      setPolicyForm({ type: "", minAmount: "0", maxAmount: "" });
      toast({ title: "Policy saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePolicy = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiFetch(`/api/reimbursements/policies/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements/policies"] });
      toast({ title: "Policy removed" });
    },
    onError: () => toast({ title: "Error", description: "Delete failed", variant: "destructive" }),
  });

  if (orgType !== "company") {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Not Available</h2>
        <p className="text-muted-foreground text-sm">Reimbursements are only available for company organizations.</p>
      </div>
    );
  }

  const canCreate = ["employee", "manager", "org_admin"].includes(user?.role || "");
  const canAct = ["manager", "teacher", "org_admin"].includes(user?.role || "");

  function getActions(claim: any) {
    const { role } = user || {};
    if (claim.status === "rejected" || claim.status === "approved_final") return [];
    if (role === "manager" || role === "teacher") {
      if (claim.status === "pending_manager") return ["approve", "forward", "reject"];
    }
    if (role === "org_admin") {
      if (["approved_manager", "forwarded", "pending_manager"].includes(claim.status))
        return ["approve", "forward", "reject"];
    }
    return [];
  }

  const isEmployee = user?.role === "employee";
  const isSubmitDisabled =
    createClaim.isPending ||
    !form.type ||
    !form.amount ||
    !form.description ||
    !!amountError ||
    (isEmployee && !selectedManagerId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-page-title">Reimbursements</h1>
            <p className="text-sm text-muted-foreground">Manage expense claims and reimbursements</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowPolicyForm((v) => !v)} data-testid="button-manage-policies">
              <Settings2 className="w-4 h-4 mr-1.5" />
              Claim Limits
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowForm(true)} data-testid="button-new-claim">
              <Plus className="w-4 h-4 mr-2" />
              New Claim
            </Button>
          )}
        </div>
      </div>

      {/* Admin: Claim Policy Management */}
      {isAdmin && showPolicyForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Claim Limit Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(policies as any[]).length > 0 && (
              <div className="space-y-2">
                {(policies as any[]).map((p: any) => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between px-3 py-2 rounded-md border text-sm"
                    data-testid={`row-policy-${p.type}`}
                  >
                    <span className="capitalize font-medium w-28">{p.type}</span>
                    <span className="text-muted-foreground">
                      ₹{p.minAmount.toLocaleString()} – ₹{p.maxAmount.toLocaleString()}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPolicyForm({ type: p.type, minAmount: String(p.minAmount), maxAmount: String(p.maxAmount) })}
                        data-testid={`button-edit-policy-${p.type}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deletePolicy.mutate(p.type)}
                        disabled={deletePolicy.isPending}
                        data-testid={`button-delete-policy-${p.type}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Claim Type</Label>
                <Select value={policyForm.type} onValueChange={(v) => setPolicyForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="trigger-policy-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Min Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={policyForm.minAmount}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, minAmount: e.target.value }))}
                  data-testid="input-policy-min"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="Enter limit"
                  value={policyForm.maxAmount}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, maxAmount: e.target.value }))}
                  data-testid="input-policy-max"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => savePolicy.mutate()}
                disabled={savePolicy.isPending || !policyForm.type || !policyForm.maxAmount}
                data-testid="button-save-policy"
              >
                {savePolicy.isPending ? "Saving..." : "Save Policy"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPolicyForm({ type: "", minAmount: "0", maxAmount: "" })} data-testid="button-reset-policy">
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claim Submission Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Reimbursement Claim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Claim Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, amount: "" }))}>
                  <SelectTrigger data-testid="trigger-claim-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Amount (₹)
                  {activePolicy && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal" data-testid="text-policy-hint">
                      Allowed: ₹{activePolicy.minAmount.toLocaleString()} – ₹{activePolicy.maxAmount.toLocaleString()}
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className={amountError ? "border-destructive" : ""}
                  data-testid="input-amount"
                />
                {amountError && (
                  <p className="text-xs text-destructive" data-testid="text-amount-error">{amountError}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the expense..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                data-testid="input-description"
              />
            </div>
            {isEmployee && (
              <div className="space-y-1.5">
                <Label>Assign To Manager <span className="text-destructive">*</span></Label>
                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                  <SelectTrigger data-testid="trigger-select-manager">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {(managers as any[]).map((m: any) => (
                      <SelectItem key={m._id} value={m._id} data-testid={`option-manager-${m._id}`}>
                        {m.firstName} {m.lastName} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Invoice / Receipt <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                data-testid="input-invoice"
              />
              {invoiceFile && <p className="text-xs text-muted-foreground">{invoiceFile.name}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createClaim.mutate()}
                disabled={isSubmitDisabled}
                data-testid="button-submit-claim"
              >
                {createClaim.isPending ? "Submitting..." : "Submit Claim"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowForm(false); setForm({ type: "", amount: "", description: "" }); }}
                data-testid="button-cancel-claim"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claims List */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {(claims as any[]).length} Claim{(claims as any[]).length !== 1 ? "s" : ""}
        </h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (claims as any[]).length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No reimbursement claims yet.</p>
            </CardContent>
          </Card>
        ) : (
          (claims as any[]).map((claim: any) => {
            const statusCfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending_manager;
            const actions = getActions(claim);
            const claimant = claim.userId;

            return (
              <Card key={claim._id} data-testid={`card-claim-${claim._id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm capitalize" data-testid={`text-claim-type-${claim._id}`}>
                          {claim.type}
                        </span>
                        <Badge className={`text-xs ${statusCfg.className}`} data-testid={`badge-status-${claim._id}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                        <IndianRupee className="w-4 h-4" />
                        <span data-testid={`text-amount-${claim._id}`}>{claim.amount.toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-description-${claim._id}`}>{claim.description}</p>
                      {claimant && user?.role !== "employee" && (
                        <p className="text-xs text-muted-foreground">
                          By: {claimant.firstName} {claimant.lastName} ({claimant.role})
                        </p>
                      )}
                      {claim.rejectionReason && (
                        <p className="text-xs text-destructive">Reason: {claim.rejectionReason}</p>
                      )}
                      {claim.invoice && (
                        <a
                          href={`${BASE_URL}/uploads/${claim.invoice}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline-offset-2 underline"
                          data-testid={`link-invoice-${claim._id}`}
                        >
                          View Invoice
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(claim.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>

                    {actions.length > 0 && canAct && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {actions.includes("approve") && (
                          <Button
                            size="sm"
                            onClick={() => takeAction.mutate({ id: claim._id, action: "approve" })}
                            disabled={takeAction.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${claim._id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                        )}
                        {actions.includes("forward") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setForwardDialog({ id: claim._id, open: true }); setForwardTargetId(""); }}
                            disabled={takeAction.isPending}
                            data-testid={`button-forward-${claim._id}`}
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1" />
                            Forward
                          </Button>
                        )}
                        {actions.includes("reject") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => setRejectDialog({ id: claim._id, open: true })}
                            data-testid={`button-reject-${claim._id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog({ id: "", open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Reason for rejection (optional)</Label>
              <Textarea
                placeholder="Provide a reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialog({ id: "", open: false })} data-testid="button-cancel-reject">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => takeAction.mutate({ id: rejectDialog.id, action: "reject", rejectionReason: rejectReason })}
                disabled={takeAction.isPending}
                data-testid="button-confirm-reject"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={forwardDialog.open} onOpenChange={(o) => setForwardDialog({ id: "", open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Forward To</Label>
              <Select value={forwardTargetId} onValueChange={setForwardTargetId}>
                <SelectTrigger data-testid="trigger-forward-target">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {(allUsers as any[])
                    .filter((u: any) => ["manager", "org_admin"].includes(u.role) && u._id !== user?._id)
                    .map((u: any) => (
                      <SelectItem key={u._id} value={u._id} data-testid={`option-forward-${u._id}`}>
                        {u.firstName} {u.lastName} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setForwardDialog({ id: "", open: false })} data-testid="button-cancel-forward">
                Cancel
              </Button>
              <Button
                onClick={() =>
                  takeAction.mutate({
                    id: forwardDialog.id,
                    action: "forward",
                    newAssignedTo: forwardTargetId || undefined,
                  })
                }
                disabled={takeAction.isPending}
                data-testid="button-confirm-forward"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
                Forward
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
