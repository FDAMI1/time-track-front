import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, CheckCircle2, XCircle } from "lucide-react";

export interface DatabaseSettings {
  mode: "shared" | "dedicated";
  configured: boolean;
  uriHint: string;
  configuredAt: string | null;
  activatedAt: string | null;
  lastTest: { ok: boolean; at: string; message: string } | null;
  organizationCode: string;
}
interface TestResult { ok: boolean; message: string }

export const DATABASE_KEY = ["/api/tenant-database"];

// Admin Settings → Database. The address is typed here, tested, and saved encrypted; it is never
// shown again. Saving does not switch databases: that needs the verified migration below it.
export default function DatabaseCard({ children }: { children?: React.ReactNode }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: DATABASE_KEY, queryFn: () => api.get<DatabaseSettings>("/api/tenant-database") });
  const [uri, setUri] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);

  const refresh = (next?: DatabaseSettings) => {
    if (next) queryClient.setQueryData(DATABASE_KEY, next);
    else queryClient.invalidateQueries({ queryKey: DATABASE_KEY });
  };
  const fail = (err: Error) => {
    setResult({ ok: false, message: err.message });
    toast({ title: "Database", description: err.message, variant: "destructive" });
  };

  const test = useMutation({
    mutationFn: () => api.post<TestResult>("/api/tenant-database/test", uri.trim() ? { uri: uri.trim() } : {}),
    onSuccess: (r) => { setResult(r); refresh(); },
    onError: fail,
  });
  const save = useMutation({
    mutationFn: () => api.put<DatabaseSettings>("/api/tenant-database", { uri: uri.trim() }),
    onSuccess: (next) => {
      setUri("");
      setResult({ ok: true, message: "Saved. The address was tested and stored encrypted." });
      refresh(next);
      toast({ title: "Database address saved", description: "Your organization keeps using the shared database until a migration is approved." });
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.delete<DatabaseSettings>("/api/tenant-database"),
    onSuccess: (next) => { setResult(null); refresh(next); toast({ title: "Database address removed" }); },
    onError: fail,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error || !data) return null;
  const busy = test.isPending || save.isPending || remove.isPending;
  const dedicated = data.mode === "dedicated";

  return (
    <Card data-testid="card-database">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Database className="w-5 h-5" />Database</CardTitle>
        <CardDescription>Keep your organization's records in the shared platform database, or in your own MongoDB database.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Current database</dt>
            <dd data-testid="text-database-mode">{dedicated ? <Badge>Own database</Badge> : <Badge variant="secondary">Shared database</Badge>}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Organisation code</dt>
            <dd className="font-mono" data-testid="text-organization-code">{data.organizationCode || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saved address</dt>
            <dd className="font-mono break-all" data-testid="text-database-hint">{data.configured ? data.uriHint : "None"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last connection test</dt>
            <dd data-testid="text-database-last-test">
              {data.lastTest
                ? <span className={data.lastTest.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}>{data.lastTest.ok ? "Passed" : "Failed"} · {new Date(data.lastTest.at).toLocaleString()}</span>
                : "Not tested yet"}
            </dd>
          </div>
        </dl>

        {!dedicated && (
          <div className="space-y-2">
            <Label htmlFor="database-uri">MongoDB connection address</Label>
            <Input id="database-uri" type="password" autoComplete="off" spellCheck={false} placeholder="mongodb+srv://user:password@cluster.example.net/your_database" value={uri} onChange={(e) => { setUri(e.target.value); setResult(null); }} disabled={busy} data-testid="input-database-uri" />
            <p className="text-xs text-muted-foreground">Include the database name. Allow this server's IP address in your database's network access list. The address is stored encrypted and never shown again.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy || (!uri.trim() && !data.configured)} onClick={() => test.mutate()} data-testid="button-test-database">{test.isPending ? "Testing..." : "Test Connection"}</Button>
              <Button type="button" size="sm" disabled={busy || !uri.trim()} onClick={() => save.mutate()} data-testid="button-save-database">{save.isPending ? "Saving..." : "Save Configuration"}</Button>
              {data.configured && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()} data-testid="button-remove-database">Remove address</Button>}
            </div>
          </div>
        )}

        {result && (
          <p role="status" className={`flex items-start gap-2 text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`} data-testid="text-database-result">
            {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {result.message}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
