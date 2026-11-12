import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";

type Field = "firstName" | "lastName" | "username" | "email" | "role" | "password" | "phone" | "education" | "studentWhatsapp"
  | "parentWhatsapp" | "position" | "department" | "biometricId" | "status" | "location";
const FIELDS: { key: Field; label: string; required?: boolean; guesses: string[] }[] = [
  { key: "firstName", label: "First name", required: true, guesses: ["first name", "firstname", "first_name", "given name"] },
  { key: "lastName", label: "Last name", required: true, guesses: ["last name", "lastname", "last_name", "surname", "family name"] },
  { key: "username", label: "Username", required: true, guesses: ["username", "user name", "login", "user_name"] },
  { key: "email", label: "Email", required: true, guesses: ["email", "e-mail", "email address", "mail"] },
  { key: "role", label: "Role", required: true, guesses: ["role", "user role", "type"] },
  { key: "password", label: "Password", guesses: ["password", "initial password"] },
  { key: "phone", label: "Phone", guesses: ["phone", "mobile", "phone number", "contact", "phone_number"] },
  { key: "education", label: "Current education (students)", guesses: ["education", "current education", "qualification"] },
  { key: "studentWhatsapp", label: "Student WhatsApp", guesses: ["student whatsapp", "whatsapp"] },
  { key: "parentWhatsapp", label: "Parent WhatsApp", guesses: ["parent whatsapp", "parent phone", "guardian phone"] },
  { key: "position", label: "Position", guesses: ["position", "designation", "job title", "title"] },
  { key: "department", label: "Department", guesses: ["department", "dept"] },
  { key: "biometricId", label: "Biometric ID", guesses: ["biometric id", "biometric", "fingerprint id"] },
  { key: "status", label: "Status (Active / Inactive)", guesses: ["status", "account status", "active"] },
  { key: "location", label: "Location (Default / Required / Not required)", guesses: ["location", "location rule"] },
];
const SKIP = "__skip";
const SAMPLE: Record<string, string> = {
  "First name": "Asha", "Last name": "Khan", Username: "asha.k", Email: "asha.k@example.com", Role: "Employee",
  Password: "", Phone: "9876543210", "Current education (students)": "", "Student WhatsApp": "", "Parent WhatsApp": "",
  Position: "", Department: "", "Biometric ID": "", "Status (Active / Inactive)": "Active", "Location (Default / Required / Not required)": "Default",
};

interface Report {
  total: number; valid: number; created: number;
  duplicates: { row: number; name: string; reason: string }[];
  failed: { row: number; name: string; message: string }[];
}

async function saveSheet(rows: Record<string, string | number>[], fileName: string) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Members");
  XLSX.writeFile(book, fileName);
}

// Admin bulk add from Excel, built like the lead import: columns are matched to member fields
// here, the server checks every row without saving (the preview), then creates each one through
// the same rules as Add Member. Passwords never come back; leave the column empty and use
// Reset Password on Members to give someone a sign-in.
export default function ImportMembersDialog() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [preview, setPreview] = useState<Report | null>(null);
  const [done, setDone] = useState<Report | null>(null);

  const reset = () => { setFileName(""); setHeaders([]); setSheet([]); setPreview(null); setDone(null); };
  const read = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "", raw: false });
      const cols = Object.keys(rows[0] || {});
      if (!rows.length) throw new Error("The first sheet has no rows under its header");
      setFileName(file.name);
      setHeaders(cols);
      setSheet(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))));
      const guess = (f: (typeof FIELDS)[number]) => cols.find((c) => [f.label.toLowerCase(), ...f.guesses].includes(c.trim().toLowerCase()));
      setMap(Object.fromEntries(FIELDS.map((f) => [f.key, guess(f) || SKIP])) as Record<Field, string>);
      setPreview(null);
      setDone(null);
    } catch (err) {
      toast({ title: "Can't read this file", description: (err as Error).message, variant: "destructive" });
    }
  };
  const mappedFields = FIELDS.filter((f) => map[f.key] && map[f.key] !== SKIP);
  const mapped = () => sheet.map((r) => Object.fromEntries(mappedFields.map((f) => [f.key, r[map[f.key]] || ""])));
  const unmappedRequired = FIELDS.filter((f) => f.required && !mappedFields.includes(f));

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api.post<Report>("/api/users/import", { rows: mapped(), dryRun }),
    onSuccess: (report, dryRun) => {
      if (dryRun) { setPreview(report); return; }
      setDone(report);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy"] });
      toast({ title: `${report.created} members added`, description: `${report.duplicates.length} already exist, ${report.failed.length} had problems` });
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  // The rows that weren't imported, as they were in the file, with the reason. Passwords are left out.
  const downloadProblems = (report: Report) => {
    const reasons = new Map<number, string>([...report.failed.map((f) => [f.row, f.message] as const), ...report.duplicates.map((d) => [d.row, `Duplicate: ${d.reason}`] as const)]);
    const passwordColumn = map.password !== SKIP ? map.password : "";
    const rows = [...reasons.keys()].sort((a, b) => a - b).map((row) => {
      const { [passwordColumn]: _password, ...original } = sheet[row - 2] || {};
      return { Row: row, Reason: reasons.get(row) || "", ...original };
    });
    return saveSheet(rows, "member-import-problems.xlsx");
  };

  const report = done || preview;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-import-members"><FileSpreadsheet className="w-4 h-4 mr-2" />Import Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Members</DialogTitle>
          <DialogDescription>
            Excel (.xlsx, .xls) or CSV, up to 500 rows. Each row is added with the same rules as Add Member. Rows with no password get a random one: use Reset Password on Members to give them a sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} aria-label="Spreadsheet" data-testid="input-import-members-file" />
            <Button type="button" variant="outline" className="shrink-0" onClick={() => saveSheet([SAMPLE], "members-template.xlsx")} data-testid="button-members-template">
              <Download className="w-4 h-4 mr-2" />Template
            </Button>
          </div>
          {!!headers.length && (
            <>
              <p className="text-sm text-muted-foreground">{fileName} · {sheet.length} rows. Match each member field to a column (* required):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
                    <Select value={map[f.key]} onValueChange={(v) => { setMap({ ...map, [f.key]: v }); setPreview(null); }}>
                      <SelectTrigger data-testid={`select-member-map-${f.key}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don't import</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!!unmappedRequired.length && <p className="text-sm text-destructive" data-testid="text-members-map-missing">Choose a column for: {unmappedRequired.map((f) => f.label).join(", ")}</p>}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs min-w-[520px]" data-testid="table-members-sample">
                  <thead><tr className="bg-muted/50">{mappedFields.map((f) => <th key={f.key} className="text-left p-2">{f.label}</th>)}</tr></thead>
                  <tbody>{mapped().slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">{mappedFields.map((f) => <td key={f.key} className="p-2">{f.key === "password" && r[f.key] ? "••••••" : r[f.key]}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
              {!done && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" disabled={!!unmappedRequired.length || run.isPending} onClick={() => run.mutate(true)} data-testid="button-members-check">Check Rows</Button>
                  <Button disabled={!preview || !preview.valid || run.isPending} onClick={() => run.mutate(false)} data-testid="button-members-import">Import {preview ? preview.valid : ""} Members</Button>
                </div>
              )}
            </>
          )}
          {report && (
            <div className="space-y-2 rounded-md border p-3" data-testid="members-import-report">
              <div className="flex gap-2 flex-wrap text-sm">
                <Badge variant="outline">{report.total} rows</Badge>
                {done ? <Badge>{done.created} imported</Badge> : <Badge variant="secondary">{report.valid} valid</Badge>}
                <Badge variant="outline">{report.duplicates.length} duplicates</Badge>
                <Badge variant={report.failed.length ? "destructive" : "outline"}>{report.failed.length} invalid</Badge>
                {done && done.valid > done.created && <Badge variant="destructive">{done.valid - done.created} failed</Badge>}
              </div>
              {!!report.failed.length && (
                <ul className="text-xs text-destructive max-h-40 overflow-y-auto space-y-0.5" data-testid="list-members-failed">
                  {report.failed.map((f) => <li key={f.row}>Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.message}</li>)}
                </ul>
              )}
              {!!report.duplicates.length && (
                <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-0.5" data-testid="list-members-duplicates">
                  {report.duplicates.map((d) => <li key={d.row}>Row {d.row}{d.name ? ` (${d.name})` : ""}: {d.reason}</li>)}
                </ul>
              )}
              {!!(report.failed.length || report.duplicates.length) && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => downloadProblems(report)} data-testid="button-members-problems"><Download className="w-4 h-4 mr-2" />Download problem rows</Button>
                  {!done && <p className="text-xs text-muted-foreground self-center">Fix them in the file and choose it again, or import the valid rows now.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
