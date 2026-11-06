import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Field = "name" | "phone" | "email" | "source" | "course" | "assignedTo" | "nextFollowUpDate" | "note";
const FIELDS: { key: Field; label: string; required?: boolean; guesses: string[] }[] = [
  { key: "name", label: "Name", required: true, guesses: ["name", "full name", "full_name", "lead", "student", "customer"] },
  { key: "phone", label: "Phone", guesses: ["phone", "mobile", "phone number", "contact", "whatsapp", "phone_number"] },
  { key: "email", label: "Email", guesses: ["email", "e-mail", "email address", "mail"] },
  { key: "source", label: "Source", guesses: ["source", "lead source", "channel"] },
  { key: "course", label: "Course", guesses: ["course", "program", "interested in"] },
  { key: "assignedTo", label: "Assign to (username or email)", guesses: ["assigned to", "assignee", "owner", "telecaller", "counsellor", "counselor"] },
  { key: "nextFollowUpDate", label: "Follow-up date (YYYY-MM-DD)", guesses: ["follow up", "follow-up", "followup", "next follow up", "follow up date"] },
  { key: "note", label: "Note", guesses: ["note", "notes", "remarks", "comment", "message"] },
];
const SKIP = "__skip";

interface Report { created: number; valid: number; assigned: number; duplicates: { row: number; name: string; matches: string }[]; failed: { row: number; name: string; message: string }[] }

// A spreadsheet's columns are matched to lead fields here, previewed on the server without
// saving (the same checks as the real import), then imported with a full report.
export default function ImportLeadsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [preview, setPreview] = useState<Report | null>(null);
  const [done, setDone] = useState<Report | null>(null);

  const reset = () => { setFileName(""); setHeaders([]); setSheet([]); setPreview(null); setDone(null); };
  const read = async (file: File) => {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "", raw: false });
    const cols = Object.keys(rows[0] || {});
    setFileName(file.name);
    setHeaders(cols);
    setSheet(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))));
    setMap(Object.fromEntries(FIELDS.map((f) => [f.key, cols.find((c) => f.guesses.includes(c.trim().toLowerCase())) || SKIP])) as Record<Field, string>);
    setPreview(null);
    setDone(null);
  };
  const mapped = () => sheet.map((r) => Object.fromEntries(FIELDS.filter((f) => map[f.key] && map[f.key] !== SKIP).map((f) => [f.key, r[map[f.key]] || ""])));

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api.post<Report>("/api/enquiries/import", { rows: mapped(), label: fileName, dryRun }),
    onSuccess: (report, dryRun) => {
      if (dryRun) { setPreview(report); return; }
      setDone(report);
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      toast({ title: `${report.created} leads added`, description: `${report.duplicates.length} already existed, ${report.failed.length} had problems` });
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const report = done || preview;
  const nameMapped = map.name && map.name !== SKIP;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>CSV or Excel, up to 1,000 rows. Duplicates (same phone or email) are skipped. Leads with nobody assigned follow the round-robin, if it's on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} aria-label="Spreadsheet" data-testid="input-import-file" />
          {!!headers.length && (
            <>
              <p className="text-sm text-muted-foreground">{fileName} · {sheet.length} rows. Match each lead field to a column:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
                    <Select value={map[f.key]} onValueChange={(v) => { setMap({ ...map, [f.key]: v }); setPreview(null); }}>
                      <SelectTrigger data-testid={`select-map-${f.key}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don't import</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs min-w-[520px]" data-testid="table-import-sample">
                  <thead><tr className="bg-muted/50">{FIELDS.filter((f) => map[f.key] !== SKIP).map((f) => <th key={f.key} className="text-left p-2">{f.label}</th>)}</tr></thead>
                  <tbody>{mapped().slice(0, 5).map((r, i) => <tr key={i} className="border-t">{FIELDS.filter((f) => map[f.key] !== SKIP).map((f) => <td key={f.key} className="p-2">{(r as Record<string, string>)[f.key]}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {!done && (
                <div className="flex gap-2">
                  <Button variant="outline" disabled={!nameMapped || run.isPending} onClick={() => run.mutate(true)} data-testid="button-import-preview">Check Rows</Button>
                  <Button disabled={!preview || !preview.valid || run.isPending} onClick={() => run.mutate(false)} data-testid="button-import-run">Import {preview ? preview.valid : ""} Leads</Button>
                </div>
              )}
            </>
          )}
          {report && (
            <div className="space-y-2 rounded-md border p-3" data-testid="import-report">
              <div className="flex gap-2 flex-wrap text-sm">
                {done ? <Badge>{done.created} added{done.assigned ? `, ${done.assigned} assigned` : ""}</Badge> : <Badge variant="secondary">{report.valid} ready to import</Badge>}
                <Badge variant="outline">{report.duplicates.length} already exist</Badge>
                <Badge variant={report.failed.length ? "destructive" : "outline"}>{report.failed.length} with problems</Badge>
              </div>
              {!!report.failed.length && (
                <ul className="text-xs text-destructive max-h-40 overflow-y-auto space-y-0.5" data-testid="list-import-failed">
                  {report.failed.map((f) => <li key={f.row}>Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.message}</li>)}
                </ul>
              )}
              {!!report.duplicates.length && (
                <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-0.5" data-testid="list-import-duplicates">
                  {report.duplicates.map((d) => <li key={d.row}>Row {d.row} ({d.name}) matches {d.matches}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
