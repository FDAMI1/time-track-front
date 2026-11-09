import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, DollarSign, ListChecks, GripVertical } from "lucide-react";

interface SalaryComponent {
  label: string;
  type: "earning" | "deduction";
  calculationType: "fixed" | "percentage";
  value: number;
}

interface SalaryStructure {
  _id: string;
  name: string;
  components: SalaryComponent[];
}

interface SalaryInputField {
  label: string;
  key: string;
  type: "number" | "text";
  required: boolean;
}

const emptyComponent: SalaryComponent = { label: "", type: "earning", calculationType: "fixed", value: 0 };

export default function SalarySetupPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [structureDialog, setStructureDialog] = useState(false);
  const [editStructure, setEditStructure] = useState<SalaryStructure | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [structureForm, setStructureForm] = useState({ name: "", components: [{ ...emptyComponent }] as SalaryComponent[] });

  const [fieldForm, setFieldForm] = useState<SalaryInputField>({ label: "", key: "", type: "number", required: true });
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);
  const [fieldDialog, setFieldDialog] = useState(false);

  const { data: structures = [], isLoading: loadingStructures } = useQuery<SalaryStructure[]>({
    queryKey: ["/api/salary-structures"],
    queryFn: async () => {
      const res = await apiFetch("/api/salary-structures", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: inputConfig, isLoading: loadingConfig } = useQuery<{ fields: SalaryInputField[] }>({
    queryKey: ["/api/salary-input-config"],
    queryFn: async () => {
      const res = await apiFetch("/api/salary-input-config", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const createStructure = useMutation({
    mutationFn: async (data: typeof structureForm) => {
      const res = await apiFetch("/api/salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-structures"] });
      setStructureDialog(false);
      resetStructureForm();
      toast({ title: "Salary structure created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStructure = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof structureForm }) => {
      const res = await apiFetch(`/api/salary-structures/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-structures"] });
      setEditStructure(null);
      setStructureDialog(false);
      resetStructureForm();
      toast({ title: "Structure updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteStructure = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/salary-structures/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-structures"] });
      setDeleteId(null);
      toast({ title: "Structure deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const saveInputConfig = useMutation({
    mutationFn: async (fields: SalaryInputField[]) => {
      const res = await apiFetch("/api/salary-input-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-input-config"] });
      toast({ title: "Input configuration saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetStructureForm() {
    setStructureForm({ name: "", components: [{ ...emptyComponent }] });
    setEditStructure(null);
  }

  function openNewStructure() {
    resetStructureForm();
    setStructureDialog(true);
  }

  function openEditStructure(s: SalaryStructure) {
    setEditStructure(s);
    setStructureForm({ name: s.name, components: s.components.map((c) => ({ ...c })) });
    setStructureDialog(true);
  }

  function addComponent() {
    setStructureForm({ ...structureForm, components: [...structureForm.components, { ...emptyComponent }] });
  }

  function removeComponent(idx: number) {
    setStructureForm({ ...structureForm, components: structureForm.components.filter((_, i) => i !== idx) });
  }

  function updateComponent(idx: number, field: keyof SalaryComponent, value: any) {
    const comps = [...structureForm.components];
    comps[idx] = { ...comps[idx], [field]: value };
    setStructureForm({ ...structureForm, components: comps });
  }

  function handleStructureSubmit() {
    const data = {
      name: structureForm.name.trim(),
      components: structureForm.components.filter((c) => c.label.trim()),
    };
    if (!data.name) return toast({ title: "Name is required", variant: "destructive" });
    if (editStructure) updateStructure.mutate({ id: editStructure._id, data });
    else createStructure.mutate(data);
  }

  function openAddField() {
    setEditingFieldIdx(null);
    setFieldForm({ label: "", key: "", type: "number", required: true });
    setFieldDialog(true);
  }

  function openEditField(idx: number) {
    const f = inputConfig!.fields[idx];
    setEditingFieldIdx(idx);
    setFieldForm({ ...f });
    setFieldDialog(true);
  }

  function handleSaveField() {
    if (!fieldForm.label.trim() || !fieldForm.key.trim()) {
      return toast({ title: "Label and key are required", variant: "destructive" });
    }
    const currentFields = inputConfig?.fields || [];
    let updated: SalaryInputField[];
    if (editingFieldIdx !== null) {
      updated = currentFields.map((f, i) => (i === editingFieldIdx ? { ...fieldForm } : f));
    } else {
      updated = [...currentFields, { ...fieldForm }];
    }
    saveInputConfig.mutate(updated);
    setFieldDialog(false);
  }

  function removeField(idx: number) {
    const updated = (inputConfig?.fields || []).filter((_, i) => i !== idx);
    saveInputConfig.mutate(updated);
  }

  function autoKey(label: string) {
    return label.trim().replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/\s/g, "").replace(/^./, (c) => c.toLowerCase());
  }

  const fields = inputConfig?.fields || [];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="page-title" data-testid="text-salary-setup-title">Salary Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure salary structures and the input fields required before generating salary slips</p>
      </div>

      {/* Salary Structures */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Salary Structures</h2>
          </div>
          <Button size="sm" onClick={openNewStructure} data-testid="button-new-structure">
            <Plus className="w-4 h-4 mr-1" /> New Structure
          </Button>
        </div>

        {loadingStructures ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : structures.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No salary structures yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {structures.map((s) => (
              <Card key={s._id} data-testid={`card-structure-${s._id}`}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{s.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditStructure(s)} data-testid={`button-edit-structure-${s._id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(s._id)} data-testid={`button-delete-structure-${s._id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5">
                  {s.components.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No components defined</p>
                  ) : (
                    s.components.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${c.type === "earning" ? "bg-green-500" : "bg-red-500"}`} />
                          <span>{c.label}</span>
                        </div>
                        <span className="text-muted-foreground font-mono">
                          {c.calculationType === "fixed" ? `₹${c.value.toLocaleString()}` : `${c.value}%`}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Salary Input Config */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Salary Slip Input Questions</h2>
              <p className="text-sm text-muted-foreground">These fields will be shown when generating a salary slip</p>
            </div>
          </div>
          <Button size="sm" onClick={openAddField} data-testid="button-add-input-field">
            <Plus className="w-4 h-4 mr-1" /> Add Field
          </Button>
        </div>

        {loadingConfig ? (
          <Skeleton className="h-32" />
        ) : fields.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <p className="text-sm">No input fields defined yet</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Label</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Key</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Required</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((f, i) => (
                  <tr key={i} className="bg-card" data-testid={`row-input-field-${i}`}>
                    <td className="px-4 py-2.5 font-medium">{f.label}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{f.key}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs capitalize">{f.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {f.required ? <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Yes</Badge> : <span className="text-muted-foreground text-xs">No</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditField(i)} data-testid={`button-edit-field-${i}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeField(i)} data-testid={`button-remove-field-${i}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salary Structure Dialog */}
      <Dialog open={structureDialog} onOpenChange={(v) => { setStructureDialog(v); if (!v) resetStructureForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editStructure ? "Edit" : "New"} Salary Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Structure Name</Label>
              <Input
                value={structureForm.name}
                onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                placeholder="e.g. Software Engineer Tier 1"
                data-testid="input-structure-name"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Components</Label>
                <Button type="button" size="sm" variant="outline" onClick={addComponent} data-testid="button-add-component">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              {structureForm.components.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No components yet</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
                    <div className="col-span-4">Label</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-3">Calc</div>
                    <div className="col-span-2">Value</div>
                    <div className="col-span-1" />
                  </div>
                  {structureForm.components.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Input
                          value={c.label}
                          onChange={(e) => updateComponent(i, "label", e.target.value)}
                          placeholder="e.g. Basic"
                          className="h-8 text-sm"
                          data-testid={`input-comp-label-${i}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Select value={c.type} onValueChange={(v) => updateComponent(i, "type", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="earning">Earning</SelectItem>
                            <SelectItem value="deduction">Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Select value={c.calculationType} onValueChange={(v) => updateComponent(i, "calculationType", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed (₹)</SelectItem>
                            <SelectItem value="percentage">% of Basic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          value={c.value}
                          onChange={(e) => updateComponent(i, "value", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          data-testid={`input-comp-value-${i}`}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeComponent(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStructureDialog(false); resetStructureForm(); }}>Cancel</Button>
            <Button
              onClick={handleStructureSubmit}
              disabled={createStructure.isPending || updateStructure.isPending}
              data-testid="button-submit-structure"
            >
              {createStructure.isPending || updateStructure.isPending ? "Saving..." : editStructure ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Input Field Dialog */}
      <Dialog open={fieldDialog} onOpenChange={setFieldDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFieldIdx !== null ? "Edit" : "Add"} Input Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={fieldForm.label}
                onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value, key: editingFieldIdx === null ? autoKey(e.target.value) : fieldForm.key })}
                placeholder="e.g. Working Days"
                data-testid="input-field-label"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Key <span className="text-xs text-muted-foreground">(placeholder key in template)</span></Label>
              <Input
                value={fieldForm.key}
                onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value.replace(/\s/g, "") })}
                placeholder="e.g. workingDays"
                data-testid="input-field-key"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={fieldForm.type} onValueChange={(v: "number" | "text") => setFieldForm({ ...fieldForm, type: v })}>
                <SelectTrigger data-testid="select-field-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="field-required"
                checked={fieldForm.required}
                onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                className="w-4 h-4"
                data-testid="checkbox-field-required"
              />
              <Label htmlFor="field-required">Required</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveField} disabled={saveInputConfig.isPending} data-testid="button-submit-field">
              {saveInputConfig.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Structure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the salary structure.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStructure.mutate(deleteId!)}
              data-testid="button-confirm-delete-structure"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
