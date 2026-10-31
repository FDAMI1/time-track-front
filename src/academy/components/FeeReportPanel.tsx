import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Download } from "lucide-react";
import { downloadFile, useMcqApi } from "@/mcq/lib/api";
import { formatMoney, labelOf, type FeeReport } from "@/academy/lib/academy";
import { ListState } from "@/academy/components/common";

export default function FeeReportPanel() {
  const api = useMcqApi();
  const { token } = useAuth();
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/fees", "report", query],
    queryFn: () => api.get<FeeReport>(`/api/fees/report?${query}`),
  });

  const tiles = data ? [
    { label: "Collected in this period", value: formatMoney(data.collectedMinor) },
    { label: "Total billed", value: formatMoney(data.billedMinor) },
    { label: "Outstanding", value: formatMoney(data.outstandingMinor) },
    { label: `Overdue (${data.overdueCount})`, value: formatMoney(data.overdueMinor) },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="fee-report-from">From</Label>
          <Input id="fee-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-fee-report-from" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee-report-to">To</Label>
          <Input id="fee-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-fee-report-to" />
        </div>
        <Button
          variant="outline"
          onClick={() => downloadFile(`/api/fees/report/export?${query}`, token).catch((err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }))}
          data-testid="button-export-fees"
        >
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      <ListState isLoading={isLoading} error={error} isEmpty={!data} emptyText="No report" icon={BarChart3}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border bg-card p-4" data-testid={`stat-${tile.label.split(" ")[0].toLowerCase()}`}>
              <p className="text-xl font-bold">{tile.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
            </div>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Collected by method</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {(data?.byMethod || []).length === 0 && <p className="text-sm text-muted-foreground">No payments in this period</p>}
            {(data?.byMethod || []).map((row) => (
              <div key={row.method} className="flex justify-between text-sm">
                <span>{labelOf(row.method)}</span>
                <span className="font-medium">{formatMoney(row.netMinor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </ListState>
    </div>
  );
}
