import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch, safeJson } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { localDateString } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Fingerprint } from "lucide-react";

interface BiometricDevice {
  _id: string;
  serial: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string;
  lastPunchAt?: string;
}

interface BiometricPunch {
  _id: string;
  biometricId: string;
  deviceTime: string;
  result: string;
  reason: string;
  userId?: { firstName: string; lastName: string } | null;
}

const resultLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Processing", className: "bg-muted text-muted-foreground" },
  check_in: { label: "Check-in", className: "bg-chart-2/10 text-chart-2" },
  check_out: { label: "Check-out", className: "bg-chart-1/10 text-chart-1" },
  duplicate: { label: "Repeat punch", className: "bg-muted text-muted-foreground" },
  unknown_device: { label: "Machine not registered", className: "bg-chart-4/10 text-chart-4" },
  unknown_user: { label: "Unknown biometric ID", className: "bg-chart-4/10 text-chart-4" },
  rejected: { label: "Not applied", className: "bg-destructive/10 text-destructive" },
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "Never");

// Fingerprint machines and their punch log, for the organization's admin.
export function BiometricPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(localDateString());
  const auth = { Authorization: `Bearer ${token}` };

  const devices = useQuery<BiometricDevice[]>({
    queryKey: ["/api/biometric/devices"],
    queryFn: async () => {
      const res = await apiFetch("/api/biometric/devices", { headers: auth });
      if (!res.ok) throw new Error("Failed to load machines");
      return res.json();
    },
  });

  const punches = useQuery<BiometricPunch[]>({
    queryKey: ["/api/biometric/punches", date],
    queryFn: async () => {
      const res = await apiFetch(`/api/biometric/punches?date=${date}`, { headers: auth });
      if (!res.ok) throw new Error("Failed to load punches");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const save = useMutation({
    mutationFn: async ({ path, method, body }: { path: string; method: string; body: object }) => {
      const res = await apiFetch(path, { method, headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await safeJson<{ message?: string }>(res);
      if (!res.ok) throw new Error(data.message || "Request failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/punches"] });
    },
    onError: (err: Error) => toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const addDevice = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { path: "/api/biometric/devices", method: "POST", body: { serial, name } },
      { onSuccess: () => { setSerial(""); setName(""); toast({ title: "Machine registered" }); } }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Fingerprint className="w-5 h-5" /> Fingerprint machines</CardTitle>
          <CardDescription>
            Punches count only from registered machines. Set each member's Biometric ID on the Members page to the number the machine shows for them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addDevice} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="biometric-serial">Serial number</Label>
              <Input id="biometric-serial" data-testid="input-biometric-serial" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. RSS20241094880" required />
            </div>
            <div>
              <Label htmlFor="biometric-name">Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="biometric-name" data-testid="input-biometric-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main entrance" />
            </div>
            <Button type="submit" disabled={save.isPending || !serial.trim()} data-testid="button-add-biometric-device">Register machine</Button>
          </form>

          {devices.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (devices.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No machines registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Last contact</TableHead>
                    <TableHead>Last punch</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(devices.data || []).map((d) => (
                    <TableRow key={d._id} data-testid={`row-biometric-device-${d._id}`}>
                      <TableCell>
                        <p className="font-medium">{d.name || d.serial}</p>
                        {d.name && <p className="text-xs text-muted-foreground">{d.serial}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDateTime(d.lastSeenAt)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDateTime(d.lastPunchAt)}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={d.isActive}
                          aria-label={`Accept punches from ${d.name || d.serial}`}
                          onCheckedChange={(isActive) => save.mutate({ path: `/api/biometric/devices/${d._id}`, method: "PUT", body: { isActive } })}
                          data-testid={`switch-biometric-device-${d._id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Punch log</CardTitle>
            <CardDescription>Every punch the machines sent, and what it did to attendance.</CardDescription>
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" aria-label="Punch date" data-testid="input-biometric-date" />
        </CardHeader>
        <CardContent className="p-0">
          {punches.isLoading ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : punches.error ? (
            <p className="p-6 text-sm text-destructive">{(punches.error as Error).message}</p>
          ) : (punches.data || []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No punches on this day.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(punches.data || []).map((p) => {
                    const r = resultLabels[p.result] || resultLabels.pending;
                    return (
                      <TableRow key={p._id} data-testid={`row-biometric-punch-${p._id}`}>
                        <TableCell className="whitespace-nowrap text-sm">{p.deviceTime.slice(11)}</TableCell>
                        <TableCell className="text-sm">
                          {p.userId ? `${p.userId.firstName} ${p.userId.lastName}` : <span className="text-muted-foreground">—</span>}
                          <p className="text-xs text-muted-foreground">ID {p.biometricId}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-md ${r.className}`}>{r.label}</span>
                          {p.reason && <p className="text-xs text-muted-foreground mt-1">{p.reason}</p>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
