import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon } from "lucide-react";

interface StorageSettings {
  configured: boolean;
  enabled: boolean;
  cloudName: string;
  keyHint: string;
  configuredAt: string | null;
  lastTest: { ok: boolean; at: string; message: string } | null;
  platformAvailable: boolean;
}
const KEY = ["/api/tenant-storage"];
const EMPTY = { cloudName: "", apiKey: "", apiSecret: "" };

// Settings → Image Storage: the organization's own Cloudinary account for logos, photos, course images
// and files. The key and secret are checked with Cloudinary, stored on the server, never shown again.
export default function StorageCard() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => api.get<StorageSettings>("/api/tenant-storage") });
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const failed = (err: Error) => { setResult({ ok: false, message: err.message }); toast({ title: "Image storage", description: err.message, variant: "destructive" }); };
  const saved = (next: StorageSettings) => queryClient.setQueryData(KEY, next);
  const filled = !!(form.cloudName.trim() && form.apiKey.trim() && form.apiSecret.trim());

  const test = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message: string }>("/api/tenant-storage/test", filled ? form : {}),
    onSuccess: (r) => { setResult(r); queryClient.invalidateQueries({ queryKey: KEY }); },
    onError: failed,
  });
  const save = useMutation({
    mutationFn: () => api.put<StorageSettings>("/api/tenant-storage", form),
    onSuccess: (next) => { saved(next); setForm(EMPTY); setResult({ ok: true, message: "Saved. New uploads go to your Cloudinary account." }); },
    onError: failed,
  });
  const toggle = useMutation({ mutationFn: (enabled: boolean) => api.put<StorageSettings>("/api/tenant-storage/enabled", { enabled }), onSuccess: saved, onError: failed });
  const remove = useMutation({ mutationFn: () => api.delete<StorageSettings>("/api/tenant-storage"), onSuccess: (next) => { saved(next); setResult(null); }, onError: failed });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;
  const busy = test.isPending || save.isPending || toggle.isPending || remove.isPending;

  return (
    <Card data-testid="card-storage">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5" />Image Storage</CardTitle>
        <CardDescription>Logos, profile photos, course images and attachments are stored on Cloudinary. Use your own Cloudinary account, or the platform's.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <label htmlFor="storage-enabled" className="text-sm">
            <span className="font-medium">Use our own Cloudinary account</span>
            <span className="block text-xs text-muted-foreground" data-testid="text-storage-status">
              {data.configured ? `Account ${data.cloudName} (key ending ${data.keyHint})` : "Not set up"} · {data.enabled ? "new uploads go to your account" : data.platformAvailable ? "new uploads go to the platform account" : "the platform has no account"}
            </span>
          </label>
          <Switch id="storage-enabled" checked={data.enabled} disabled={busy || !data.configured} onCheckedChange={(on) => toggle.mutate(on)} data-testid="switch-storage-enabled" />
        </div>
        {data.lastTest && (
          <p className={`text-xs ${data.lastTest.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`} data-testid="text-storage-last-test">
            Connection {data.lastTest.ok ? "working" : "failed"} · checked {new Date(data.lastTest.at).toLocaleString()}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label htmlFor="cld-name">Cloud name</Label><Input id="cld-name" autoComplete="off" value={form.cloudName} onChange={(e) => setForm({ ...form, cloudName: e.target.value })} placeholder={data.cloudName || "your-cloud"} data-testid="input-cloud-name" /></div>
          <div><Label htmlFor="cld-key">API key</Label><Input id="cld-key" type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} data-testid="input-cloud-key" /></div>
          <div><Label htmlFor="cld-secret">API secret</Label><Input id="cld-secret" type="password" autoComplete="off" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} data-testid="input-cloud-secret" /></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" size="sm" variant="outline" disabled={busy || (!filled && !data.configured)} onClick={() => test.mutate()} data-testid="button-test-storage">{test.isPending ? "Testing..." : "Test Connection"}</Button>
          <Button type="button" size="sm" disabled={busy || !filled} onClick={() => save.mutate()} data-testid="button-save-storage">{save.isPending ? "Checking..." : "Save Configuration"}</Button>
          {data.configured && !data.enabled && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove.mutate()} data-testid="button-remove-storage">Remove account</Button>}
        </div>
        {result && <p role="status" className={`text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`} data-testid="text-storage-result">{result.message}</p>}
        <p className="text-xs text-muted-foreground">Find these on your Cloudinary dashboard. Turning the account off sends new uploads back to the platform account; files already in your account keep working.</p>
      </CardContent>
    </Card>
  );
}
