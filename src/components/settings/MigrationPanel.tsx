import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DATABASE_KEY, type DatabaseSettings } from "@/components/settings/DatabaseCard";

interface PlanRow { model: string; coll: string; scope: string; total: number; copied: number; done: boolean }
interface CheckRow { coll: string; ok: boolean; source?: number; destination?: number; problems: string[] }
interface Verification { at: string; ok: boolean; sourceTotal: number; destinationTotal: number; collections: CheckRow[]; relationships: { coll: string; path: string; target: string; ok: boolean; sourceOutside: number; destinationOutside: number }[] }
interface Migration {
  _id: string; direction: "toDedicated" | "toShared"; status: string; active: boolean; plan: PlanRow[];
  totals: { records: number; copied: number }; relationships: unknown[]; eventsApplied: number;
  verification: Verification | null; error: string; createdAt: string; log: { at: string; level: string; message: string }[];
}
interface MigrationResponse { organization: string; database: { mode: string; hint: string }; migration: Migration | null }

const KEY = ["/api/tenant-migration"];
const LABELS: Record<string, string> = {
  previewed: "Preview ready", copying: "Copying", syncing: "Copied · live sync running", verifying: "Verifying",
  verified: "Verified · waiting for approval", activating: "Switching", activated: "Done", failed: "Failed", cancelled: "Cancelled",
};

// Moving the organization to its own database: preview → copy with live sync → verify → approve.
export default function MigrationPanel({ settings }: { settings: DatabaseSettings }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<"approve" | "rollback" | null>(null);
  const [typed, setTyped] = useState("");
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<MigrationResponse>("/api/tenant-migration"),
    refetchInterval: (q) => (q.state.data?.migration?.active ? 2000 : false),
  });
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api.post<MigrationResponse>(`/api/tenant-migration/${path}`, body || {}),
    onSuccess: (next) => {
      queryClient.setQueryData(KEY, next);
      queryClient.invalidateQueries({ queryKey: DATABASE_KEY });
      setConfirming(null);
      setTyped("");
    },
    onError: (err: Error) => toast({ title: "Migration", description: err.message, variant: "destructive" }),
  });
  const status = data?.migration?.status;
  // The card above shows which database is in use; it changes when a switch completes.
  useEffect(() => {
    if (status) queryClient.invalidateQueries({ queryKey: DATABASE_KEY });
  }, [status]);
  if (!data) return null;
  const m = data.migration;
  const live = m?.active ? m : null;
  const dedicated = data.database.mode === "dedicated";
  const run = (path: string, body?: unknown) => action.mutate({ path, body });
  const busy = action.isPending;
  const percent = live && live.totals.records ? Math.min(100, Math.round((live.totals.copied / live.totals.records) * 100)) : 0;

  return (
    <section className="border-t pt-4 space-y-3" aria-labelledby="migration-title" data-testid="migration-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 id="migration-title" className="font-semibold">{dedicated ? "Your own database is in use" : "Move to your own database"}</h3>
        {m && <Badge variant={m.status === "failed" ? "destructive" : "secondary"} data-testid="badge-migration-status">{m.direction === "toShared" ? "Rollback · " : ""}{LABELS[m.status] || m.status}</Badge>}
      </div>

      {!live && !dedicated && (
        <>
          <p className="text-sm text-muted-foreground">Copies every record of your organization to your own database while people keep working. Changes made meanwhile are carried over. Nothing switches until you approve, and the shared copy is kept.</p>
          <Button size="sm" disabled={busy || !settings.configured || !settings.lastTest?.ok} onClick={() => run("preview")} data-testid="button-migration-preview">Prepare Preview</Button>
          {!settings.lastTest?.ok && <p className="text-xs text-muted-foreground">Save and test your database address first.</p>}
        </>
      )}

      {live?.status === "previewed" && (
        <div className="space-y-2">
          <p className="text-sm">From <b>Shared database</b> to <b className="font-mono">{data.database.hint}</b> · {live.totals.records} records in {live.plan.filter((p) => p.total).length} collections · {live.relationships.length} relationships checked</p>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Collection</TableHead><TableHead className="text-right">Records</TableHead><TableHead className="hidden sm:table-cell">Linked by</TableHead></TableRow></TableHeader>
              <TableBody>
                {live.plan.filter((p) => p.total).map((p) => (
                  <TableRow key={p.coll}><TableCell>{p.coll}</TableCell><TableCell className="text-right">{p.total}</TableCell><TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{p.scope}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={busy} onClick={() => run("start")} data-testid="button-migration-start">Start Migration</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("cancel")}>Discard</Button>
          </div>
        </div>
      )}

      {live && live.status !== "previewed" && (
        <div className="space-y-2">
          {live.direction === "toDedicated" && <div><Progress value={percent} aria-label="Copy progress" /><p className="text-xs text-muted-foreground mt-1">{live.totals.copied} of {live.totals.records} records copied · {live.eventsApplied} live changes carried over</p></div>}
          <div className="flex gap-2 flex-wrap">
            {["syncing", "verified"].includes(live.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => run("verify")} data-testid="button-migration-verify">Verify Again</Button>}
            {live.status === "verified" && live.direction === "toDedicated" && <Button size="sm" disabled={busy} onClick={() => setConfirming("approve")} data-testid="button-migration-approve">Approve and Switch</Button>}
            {live.status !== "activating" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("cancel")} data-testid="button-migration-cancel">Cancel</Button>}
          </div>
        </div>
      )}

      {dedicated && !live && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming("rollback")} data-testid="button-migration-rollback">Roll Back to Shared Database</Button>}

      {m?.verification && (
        <div className={`rounded-md border p-3 text-sm space-y-1 ${m.verification.ok ? "border-green-300 dark:border-green-800" : "border-destructive"}`} data-testid="migration-verification">
          <p className="font-medium">{m.verification.ok ? "Verification passed" : "Verification found differences"} · {m.verification.sourceTotal} source / {m.verification.destinationTotal} destination records</p>
          {m.verification.collections.filter((c) => !c.ok).map((c) => <p key={c.coll} className="text-destructive">{c.coll}: {c.problems.join("; ")}</p>)}
          {m.verification.relationships.filter((r) => !r.ok).map((r) => <p key={`${r.coll}.${r.path}`} className="text-destructive">{r.coll}.{r.path} → {r.target}: {r.destinationOutside - r.sourceOutside} broken links</p>)}
          <p className="text-xs text-muted-foreground">Checked {new Date(m.verification.at).toLocaleString()}: record counts, missing and extra records, sample records, required fields, indexes and links.</p>
        </div>
      )}
      {m?.error && <p className="text-sm text-destructive" role="alert">{m.error}</p>}
      {m && m.log.length > 0 && (
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Migration log</summary>
          <ul className="mt-1 space-y-0.5">{m.log.slice(-10).map((l, i) => <li key={i}>{new Date(l.at).toLocaleTimeString()} · {l.message}</li>)}</ul>
        </details>
      )}

      <Dialog open={!!confirming} onOpenChange={(open) => { if (!open) { setConfirming(null); setTyped(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming === "approve" ? "Switch to your own database?" : "Roll back to the shared database?"}</DialogTitle>
            <DialogDescription>{confirming === "approve"
              ? "Everyone in your organization will use your own database from now on. The shared copy is kept, so you can roll back."
              : "Everything in your own database, including changes made there, is copied back, checked, and the organization switches back."}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="confirm-org">Type <b>{data.organization}</b> to confirm</Label>
          <Input id="confirm-org" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="input-migration-confirm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button disabled={busy || typed.trim() !== data.organization} onClick={() => run(confirming === "approve" ? "approve" : "rollback", { confirm: typed.trim() })} data-testid="button-migration-confirm">{confirming === "approve" ? "Approve and Switch" : "Roll Back"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
