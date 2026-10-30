import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { downloadFile, useMcqApi } from "@/mcq/lib/api";
import { capitalize, formatDuration, type TicketSummary } from "@/tickets/lib/types";

function Breakdown({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No tickets</p> : (
          <div style={{ height: Math.max(120, rows.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Tickets" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TicketReportsPage() {
  const api = useMcqApi();
  const { token } = useAuth();
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", `${to}T23:59:59`);
  const query = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/tickets/reports/summary", query],
    queryFn: () => api.get<TicketSummary>(`/api/tickets/reports/summary?${query}`),
  });

  const stats = [
    { label: "Total", value: data?.total, href: "/" },
    { label: "Open", value: data?.open, href: "/?status=open" },
    { label: "In Progress", value: data?.inProgress, href: "/?status=in_progress" },
    { label: "Pending", value: data?.pending, href: "/?statusType=pending" },
    { label: "Resolved or Closed", value: data?.resolved, href: "/?statusType=resolved" },
    { label: "Overdue", value: data?.overdue, href: "/?dueBy=overdue" },
    { label: "Unassigned", value: data?.unassigned, href: "/?agentId=unassigned&state=unresolved" },
    { label: "Due Today", value: data?.dueToday, href: "/?dueBy=today" },
    { label: "SLA Breaches", value: data?.breaches, href: "/" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Based on the date each ticket was created</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-report-from" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-report-to" />
          </div>
          <Button
            variant="outline"
            onClick={() => downloadFile(`/api/tickets/reports/export?${query}`, token).catch((err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }))}
            data-testid="button-export-tickets"
          >
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-2xl font-bold">{stat.value ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card><CardContent className="p-4"><p className="text-xl font-bold">{formatDuration(data.avgFirstResponseMs)}</p><p className="text-xs text-muted-foreground mt-1">Average first response</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xl font-bold">{formatDuration(data.avgResolutionMs)}</p><p className="text-xs text-muted-foreground mt-1">Average resolution</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Breakdown title="By Priority" rows={data.byPriority.map((p) => ({ name: capitalize(p._id), count: p.count }))} />
            <Breakdown title="By Category" rows={data.byCategory} />
            <Breakdown title="By Department" rows={data.byDepartment} />
            <Breakdown title="By Agent" rows={data.byAgent} />
          </div>
        </>
      )}
    </div>
  );
}
