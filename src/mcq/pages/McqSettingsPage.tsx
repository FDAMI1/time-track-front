import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Upload, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { isMcqAdmin } from "@/mcq/lib/roles";
import type { McqPdfTemplate, McqSettings } from "@/mcq/lib/types";

const MAX_TEMPLATES = 5;

export default function McqSettingsPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = isMcqAdmin(user?.role);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ proctorWarningLimit: 5, screenshotRetentionDays: 30 });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["/api/mcq/pdf-templates"],
    queryFn: () => api.get<McqPdfTemplate[]>("/api/mcq/pdf-templates"),
  });
  const { data: settings } = useQuery({
    queryKey: ["/api/mcq/settings"],
    queryFn: () => api.get<McqSettings>("/api/mcq/settings"),
  });

  useEffect(() => {
    if (settings) setForm({ proctorWarningLimit: settings.proctorWarningLimit, screenshotRetentionDays: settings.screenshotRetentionDays });
  }, [settings]);

  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData();
      data.append("template", file);
      data.append("name", file.name.replace(/\.[^.]+$/, ""));
      return api.post("/api/mcq/pdf-templates", data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/pdf-templates"] }); toast({ title: "Template uploaded successfully" }); },
    onError,
  });
  const removeTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcq/pdf-templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/pdf-templates"] }); toast({ title: "Template deleted" }); },
    onError,
  });
  const saveSettings = useMutation({
    mutationFn: () => api.patch<McqSettings>("/api/mcq/settings", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mcq/settings"] }); toast({ title: "MCQ settings saved" }); },
    onError,
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast({ title: "File too large", description: "Template must be under 5MB", variant: "destructive" });
    if (!["image/png", "image/jpeg"].includes(file.type)) return toast({ title: "Invalid file type", description: "Please upload a PNG or JPG image", variant: "destructive" });
    if (templates.length >= MAX_TEMPLATES) return toast({ title: "Limit reached", description: `Maximum ${MAX_TEMPLATES} templates allowed. Delete one first.`, variant: "destructive" });
    upload.mutate(file);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">MCQ Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">PDF templates and proctoring defaults for your organization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />PDF Templates</CardTitle>
          <CardDescription>Upload PNG/JPG images to use as full-page backgrounds when downloading a test as PDF. Up to {MAX_TEMPLATES} templates; test content is placed inside a white panel over the template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t._id} className="border border-border rounded-lg p-3 flex flex-col items-center gap-2 text-center" data-testid={`template-card-${t._id}`}>
                  <div className="w-12 h-16 rounded border border-border bg-primary/5 flex items-center justify-center"><FileText className="w-6 h-6 text-primary" /></div>
                  <p className="text-xs text-foreground font-medium truncate max-w-full">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" data-testid={`button-delete-template-${t._id}`}><Trash2 className="w-3 h-3 mr-1" />Delete</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete Template</AlertDialogTitle><AlertDialogDescription>Delete the template "{t.name}"?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removeTemplate.mutate(t._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No templates uploaded yet.</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFile} data-testid="input-template-upload" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending || templates.length >= MAX_TEMPLATES} data-testid="button-upload-template">
              {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Upload Template
            </Button>
            <span className="text-xs text-muted-foreground">{templates.length}/{MAX_TEMPLATES} templates</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-primary" />Proctoring Defaults</CardTitle>
          <CardDescription>Warning limit applied to public (share-link) tests, and how long proctoring screenshots are kept before automatic deletion.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveSettings.mutate(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mcq-warning-limit">Public test warning limit (1-50)</Label>
                <Input id="mcq-warning-limit" type="number" min={1} max={50} value={form.proctorWarningLimit} onChange={(e) => setForm({ ...form, proctorWarningLimit: Number(e.target.value) })} disabled={!isAdmin} data-testid="input-settings-warning-limit" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcq-retention">Screenshot retention (days, 1-365)</Label>
                <Input id="mcq-retention" type="number" min={1} max={365} value={form.screenshotRetentionDays} onChange={(e) => setForm({ ...form, screenshotRetentionDays: Number(e.target.value) })} disabled={!isAdmin} data-testid="input-settings-retention" />
              </div>
            </div>
            {isAdmin ? (
              <Button type="submit" disabled={saveSettings.isPending} data-testid="button-save-settings">{saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Settings</Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only organization admins can change these values.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
