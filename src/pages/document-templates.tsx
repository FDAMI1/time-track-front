import { apiFetch } from "@/lib/api";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Upload, Trash2, Download, FileText, FileCode, File } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const PRESET_TYPES = [
  { value: "salary_slip", label: "Salary Slip" },
  { value: "offer_letter", label: "Offer Letter" },
  { value: "onboarding_letter", label: "Onboarding Letter" },
  { value: "relieving_letter", label: "Relieving Letter" },
  { value: "certificate", label: "Certificate" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "internship_letter", label: "Internship Letter" },
  { value: "warning_letter", label: "Warning Letter" },
  { value: "custom", label: "Custom (type below)..." },
];

function getDocTypeLabel(type: string): string {
  const found = PRESET_TYPES.find((t) => t.value === type);
  return found && found.value !== "custom" ? found.label : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DOCTYPE_LABELS: Record<string, string> = {
  salary_slip: "Salary Slip",
  offer_letter: "Offer Letter",
  onboarding_letter: "Onboarding Letter",
  relieving_letter: "Relieving Letter",
  certificate: "Certificate",
  experience_letter: "Experience Letter",
  internship_letter: "Internship Letter",
  warning_letter: "Warning Letter",
};

const DOCTYPE_BADGE_COLORS: Record<string, string> = {
  salary_slip: "bg-blue-100 text-blue-700",
  offer_letter: "bg-green-100 text-green-700",
  onboarding_letter: "bg-yellow-100 text-yellow-700",
  relieving_letter: "bg-red-100 text-red-700",
  certificate: "bg-purple-100 text-purple-700",
};

const TEMPLATE_TYPE_ICON: Record<string, any> = {
  html: FileCode,
  docx: FileText,
};

interface Template {
  _id: string;
  documentType: string;
  title: string;
  templateType: "html" | "docx";
  templateFileUrl?: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
}

export default function DocumentTemplatesPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ title: "", documentType: "offer_letter", customType: "" });

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/document-templates"],
    queryFn: async () => {
      const res = await apiFetch("/api/document-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    enabled: !!token && user?.role !== "superadmin",
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("templateFile", selectedFile);
      formData.append("title", uploadForm.title);
      const finalType = uploadForm.documentType === "custom"
        ? uploadForm.customType.trim().toLowerCase().replace(/\s+/g, "_")
        : uploadForm.documentType;
      formData.append("documentType", finalType);
      const res = await apiFetch("/api/document-templates", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({ title: "", documentType: "offer_letter", customType: "" });
      toast({ title: "Template uploaded successfully" });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/document-templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setDeleteId(null);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canUpload = user?.role === "org_admin";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Document Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload pre-designed templates (HTML or DOCX) — up to 10MB
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-template">
            <Upload className="w-4 h-4 mr-2" /> Upload Template
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">Supported placeholders in your templates:</p>
        <div className="flex flex-wrap gap-2">
          {["{{name}}", "{{date}}", "{{position}}", "{{salary}}", "{{course}}", "{{duration}}", "{{organization}}", "{{email}}", "{{phone}}", "{{firstName}}", "{{lastName}}"].map((p) => (
            <code key={p} className="bg-background border rounded px-2 py-0.5 text-xs font-mono">{p}</code>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Design your template externally with these placeholders. The system replaces them with real user data during generation.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates uploaded yet</p>
          {canUpload && <p className="text-sm mt-1">Click "Upload Template" to get started</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const Icon = TEMPLATE_TYPE_ICON[t.templateType] || FileText;
            return (
              <Card key={t._id} data-testid={`card-template-${t._id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold leading-tight truncate">{t.title}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOCTYPE_BADGE_COLORS[t.documentType] || "bg-gray-100 text-gray-700"}`}>
                          {getDocTypeLabel(t.documentType)}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase font-mono">.{t.templateType}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {t.createdBy && <span>By {t.createdBy.firstName} {t.createdBy.lastName}</span>}
                      {t.createdAt && <span className="ml-2">{format(new Date(t.createdAt), "dd MMM yyyy")}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          const res = await apiFetch(`/api/document-templates/${t._id}/download`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!res.ok) { toast({ title: "Download failed", variant: "destructive" }); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          const cd = res.headers.get("content-disposition") || "";
                          const match = cd.match(/filename="([^"]+)"/);
                          a.download = match ? match[1] : `${t.title}.${t.templateType}`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        data-testid={`button-download-template-${t._id}`}
                        title="Download template file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {canUpload && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 px-2"
                          onClick={() => setDeleteId(t._id)}
                          data-testid={`button-delete-template-${t._id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Title</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder="e.g. Monthly Salary Slip"
                data-testid="input-template-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select
                value={uploadForm.documentType}
                onValueChange={(v) => setUploadForm({ ...uploadForm, documentType: v, customType: "" })}
              >
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {uploadForm.documentType === "custom" && (
                <Input
                  value={uploadForm.customType}
                  onChange={(e) => setUploadForm({ ...uploadForm, customType: e.target.value })}
                  placeholder="e.g. Experience Letter"
                  className="mt-1.5"
                  data-testid="input-custom-doc-type"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Template File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="div-file-drop-zone"
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileText className="w-8 h-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">Click to select file</p>
                    <p className="text-xs text-muted-foreground">HTML or DOCX — max 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      toast({ title: "File too large", description: "File size must be less than 10MB.", variant: "destructive" });
                      e.target.value = "";
                      return;
                    }
                    setSelectedFile(file);
                  }}
                  data-testid="input-template-file"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setSelectedFile(null); }}>Cancel</Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !selectedFile || !uploadForm.title}
              data-testid="button-submit-upload"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the template and its file. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteId!)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
