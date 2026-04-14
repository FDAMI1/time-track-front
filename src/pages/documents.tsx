import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Download, FileText, Loader2 } from "lucide-react";

const PRESET_DOC_TYPES: Record<string, string> = {
  salary_slip: "Salary Slip",
  offer_letter: "Offer Letter",
  onboarding_letter: "Onboarding Letter",
  relieving_letter: "Relieving Letter",
  certificate: "Certificate",
};

interface Template {
  _id: string;
  title: string;
  documentType: string;
  templateType: "html" | "docx";
  templateHTML?: string;
}

interface OrgUser {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface SalaryStructure {
  _id: string;
  name: string;
  components: Array<{ label: string; type: string; calculationType: string; value: number }>;
}

interface InputField {
  label: string;
  key: string;
  type: "number" | "text";
  required: boolean;
}

function docTypeLabel(type: string) {
  return PRESET_DOC_TYPES[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTemplateKeys(html: string): string[] {
  const matches = html.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

function isSalarySlip(type: string) {
  return type === "salary_slip" || type.toLowerCase().includes("salary");
}

export default function DocumentsPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [genForm, setGenForm] = useState({
    templateId: "",
    userId: "",
    format: "html",
    extraData: {} as Record<string, string>,
    salaryStructureId: "",
    salaryInputs: {} as Record<string, any>,
    autoFill: true,
  });
  const canGenerate = ["org_admin", "manager", "teacher"].includes(user?.role || "");
  const isEndUser = ["employee", "student"].includes(user?.role || "");

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/document-templates"],
    queryFn: async () => {
      const res = await fetch("/api/document-templates", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && canGenerate,
  });

  const { data: members = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && canGenerate,
  });

  const { data: salaryStructures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ["/api/salary-structures"],
    queryFn: async () => {
      const res = await fetch("/api/salary-structures", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && canGenerate,
  });

  const { data: inputConfig } = useQuery<{ fields: InputField[] }>({
    queryKey: ["/api/salary-input-config"],
    queryFn: async () => {
      const res = await fetch("/api/salary-input-config", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { fields: [] };
      return res.json();
    },
    enabled: !!token && canGenerate,
  });

  const { data: placeholderData } = useQuery<{ placeholders: string[] }>({
    queryKey: ["/api/document-templates", genForm.templateId, "placeholders"],
    queryFn: async () => {
      const res = await fetch(`/api/document-templates/${genForm.templateId}/placeholders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { placeholders: [] };
      return res.json();
    },
    enabled: !!token && !!genForm.templateId,
  });

  const selectedTemplate = templates.find((t) => t._id === genForm.templateId);
  const showSalaryFlow = selectedTemplate && isSalarySlip(selectedTemplate.documentType);
  const selectedStructure = salaryStructures.find((s) => s._id === genForm.salaryStructureId);
  const inputFields = inputConfig?.fields || [];

  const templatePlaceholders: string[] = placeholderData?.placeholders || [];

  // Reset form data when template changes
  useEffect(() => {
    setGenForm((prev) => ({ ...prev, salaryStructureId: "", salaryInputs: {}, extraData: {}, autoFill: true }));
  }, [genForm.templateId]);

  // Calculate salary preview
  function calcPreview(): { label: string; amount: number; type: string }[] {
    if (!selectedStructure || !genForm.salaryInputs) return [];
    const baseSalary = parseFloat(String(genForm.salaryInputs.basicSalary || genForm.salaryInputs.basic || genForm.salaryInputs.baseSalary || 0));
    return selectedStructure.components.map((c) => ({
      label: c.label,
      type: c.type,
      amount: c.calculationType === "fixed" ? c.value : (c.value / 100) * baseSalary,
    }));
  }

  const preview = calcPreview();
  const totalEarnings = preview.filter((p) => p.type === "earning").reduce((sum, p) => sum + p.amount, 0);
  const totalDeductions = preview.filter((p) => p.type === "deduction").reduce((sum, p) => sum + p.amount, 0);
  const netSalary = totalEarnings - totalDeductions;

  async function handleGenerate() {
    if (!genForm.templateId || !genForm.userId) return;

    // Frontend validation: when manual mode, check all placeholder fields are filled
    if (!genForm.autoFill && templatePlaceholders.length > 0) {
      const missing = templatePlaceholders.filter((k) => !genForm.extraData[k] || !genForm.extraData[k].trim());
      if (missing.length > 0) {
        toast({
          title: "All fields are required",
          description: `Please fill in: ${missing.map((k) => k.replace(/_/g, " ")).join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    setGenerating(true);
    try {
      const payload: any = {
        templateId: genForm.templateId,
        userId: genForm.userId,
        autoFill: genForm.autoFill,
        values: genForm.autoFill ? {} : genForm.extraData,
        extraData: genForm.extraData,
        format: genForm.format,
      };
      if (showSalaryFlow && genForm.salaryStructureId) {
        payload.salaryStructureId = genForm.salaryStructureId;
        payload.salaryInputs = genForm.salaryInputs;
      }

      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `document.${genForm.format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setGenerateOpen(false);
      setGenForm({ templateId: "", userId: "", format: "html", extraData: {}, salaryStructureId: "", salaryInputs: {} });
      toast({ title: "Document generated and downloaded" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-documents-title">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isEndUser
              ? "Request your documents from an admin, manager, or teacher"
              : "Generate documents instantly — no storage, download immediately"}
          </p>
        </div>
        {canGenerate && (
          <Button onClick={() => setGenerateOpen(true)} data-testid="button-generate-document">
            <FilePlus2 className="w-4 h-4 mr-2" /> Generate Document
          </Button>
        )}
      </div>

      {canGenerate && (
        <>
          {loadingTemplates ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No templates available</p>
              <p className="text-sm mt-1">Upload a template on the Document Templates page first</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">Available Templates ({templates.length})</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <Card key={t._id} className="cursor-pointer hover:border-primary/50 transition-colors" data-testid={`card-template-${t._id}`}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{docTypeLabel(t.documentType)}</span>
                            <span className="text-xs font-mono uppercase text-muted-foreground">.{t.templateType}</span>
                          </div>
                          {t.templateHTML && extractTemplateKeys(t.templateHTML).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {extractTemplateKeys(t.templateHTML).map((k) => (
                                <Badge key={k} variant="secondary" className="text-xs px-1.5 py-0 h-4 font-mono">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            const preferredFormat = t.templateType === "docx" ? "docx" : "html";
                            setGenForm({ templateId: t._id, userId: "", format: preferredFormat, extraData: {}, salaryStructureId: "", salaryInputs: {}, autoFill: true });
                            setGenerateOpen(true);
                          }}
                          data-testid={`button-use-template-${t._id}`}
                        >
                          Use
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isEndUser && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Contact your admin or manager</p>
          <p className="text-sm mt-1">They will generate your documents and share them with you</p>
        </div>
      )}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={genForm.templateId} onValueChange={(v) => {
                const tpl = templates.find((t) => t._id === v);
                const preferredFormat = tpl?.templateType === "docx" ? "docx" : "html";
                setGenForm({ ...genForm, templateId: v, format: preferredFormat, salaryStructureId: "", salaryInputs: {} });
              }}>
                <SelectTrigger data-testid="select-gen-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.title} — {docTypeLabel(t.documentType)} (.{t.templateType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Member</Label>
              <Select value={genForm.userId} onValueChange={(v) => setGenForm({ ...genForm, userId: v })}>
                <SelectTrigger data-testid="select-gen-member">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.firstName} {m.lastName} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && selectedTemplate.templateType === "html" && (
              <div className="space-y-1.5">
                <Label>Output Format</Label>
                <Select value={genForm.format} onValueChange={(v) => setGenForm({ ...genForm, format: v })}>
                  <SelectTrigger data-testid="select-output-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML (printable as PDF)</SelectItem>
                    <SelectItem value="docx">DOCX (Word document)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Salary Slip Flow */}
            {showSalaryFlow && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium">Salary Calculation</p>

                <div className="space-y-1.5">
                  <Label className="text-xs">Salary Structure</Label>
                  <Select value={genForm.salaryStructureId} onValueChange={(v) => setGenForm({ ...genForm, salaryStructureId: v })}>
                    <SelectTrigger data-testid="select-salary-structure">
                      <SelectValue placeholder="Select a salary structure (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {salaryStructures.map((s) => (
                        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {inputFields.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Salary Inputs</Label>
                    {inputFields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          type={f.type === "number" ? "number" : "text"}
                          value={genForm.salaryInputs[f.key] || ""}
                          onChange={(e) => setGenForm({ ...genForm, salaryInputs: { ...genForm.salaryInputs, [f.key]: e.target.value } })}
                          placeholder={f.label}
                          className="h-8 text-sm"
                          data-testid={`input-salary-${f.key}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Live preview */}
                {selectedStructure && preview.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground">Calculation Preview</p>
                    <div className="space-y-1">
                      {preview.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className={p.type === "earning" ? "text-green-600" : "text-red-500"}>{p.label}</span>
                          <span className="font-mono">₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      <div className="border-t pt-1 mt-1 space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Total Earnings</span>
                          <span className="font-mono text-green-600">₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Total Deductions</span>
                          <span className="font-mono text-red-500">₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Net Salary</span>
                          <span className="font-mono">₹{netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {genForm.templateId && templatePlaceholders.length > 0 && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Template Fields</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Auto Fill from System</span>
                    <Switch
                      checked={genForm.autoFill}
                      onCheckedChange={(v) => setGenForm({ ...genForm, autoFill: v })}
                      data-testid="switch-auto-fill"
                    />
                  </div>
                </div>
                {genForm.autoFill ? (
                  <p className="text-xs text-muted-foreground">
                    System data (name, email, role, etc.) will be filled automatically.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templatePlaceholders.map((key: string) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={genForm.extraData[key] || ""}
                          onChange={(e) => setGenForm({ ...genForm, extraData: { ...genForm.extraData, [key]: e.target.value } })}
                          placeholder={`Enter ${key.replace(/_/g, " ")}`}
                          className="h-8 text-sm"
                          data-testid={`input-placeholder-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {genForm.templateId && templatePlaceholders.length === 0 && !showSalaryFlow && (
              <p className="text-xs text-muted-foreground">No custom fields detected in this template.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={generating}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !genForm.templateId || !genForm.userId}
              data-testid="button-submit-generate"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Generate & Download</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
