import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMcqApi } from "@/mcq/lib/api";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import TicketTable from "@/tickets/components/list/TicketTable";
import { capitalize, PRIORITIES, type TicketDashboard, type TicketList } from "@/tickets/lib/types";

function UnresolvedChart({ title, rows, testId }: { title: string; rows: { name: string; count: number }[]; testId: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title} ({total})</CardTitle></CardHeader>
      <CardContent>
        {total === 0 ? <p className="text-sm text-muted-foreground">No unresolved tickets</p> : (
          <div style={{ height: Math.max(140, rows.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
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

export default function TicketDashboardPage() {
  const api = useMcqApi();
  const { data: meta } = useTicketMeta();
  const { data } = useQuery({
    queryKey: ["/api/tickets/reports/dashboard"],
    queryFn: () => api.get<TicketDashboard>("/api/tickets/reports/dashboard"),
  });
  const openQuery = "agentId=me_or_unassigned&state=unresolved&limit=10";
  const { data: mine } = useQuery({
    queryKey: ["/api/tickets", openQuery],
    queryFn: () => api.get<TicketList>(`/api/tickets?${openQuery}`),
  });

  const tiles = [
    { label: "Overdue", value: data?.overdue, href: "/?dueBy=overdue" },
    { label: "Due Today", value: data?.dueToday, href: "/?dueBy=today" },
    { label: "Open", value: data?.open, href: "/?status=open" },
    { label: "On Hold", value: data?.onHold, href: "/?statusType=pending" },
    { label: "Unassigned", value: data?.unassigned, href: "/?agentId=unassigned&state=unresolved" },
    { label: "Watching", value: data?.watching, href: "/?watching=true" },
  ];
  const statusLabel = (key: string) => meta?.statuses.find((s) => s.key === key)?.label || key;
  const byPriority = [...PRIORITIES].reverse().map((p) => ({ name: capitalize(p), count: data?.byPriority.find((r) => r._id === p)?.count || 0 })).filter((r) => r.count > 0);
  const byStatus = (data?.byStatus || []).map((r) => ({ name: statusLabel(r._id), count: r.count }));

  if (!data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <h1 className="page-title">Ticket Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors" data-testid={`tile-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="text-2xl font-bold">{tile.value ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UnresolvedChart title="Unresolved by Priority" rows={byPriority} testId="chart-priority" />
        <UnresolvedChart title="Unresolved by Status" rows={byStatus} testId="chart-status" />
      </div>
      <section className="space-y-2" data-testid="dashboard-new-my-open">
        <h2 className="text-sm font-medium">New & My Open Tickets</h2>
        {mine?.tickets.length ? <TicketTable tickets={mine.tickets} meta={meta} /> : <p className="text-sm text-muted-foreground">Nothing waiting for you</p>}
      </section>
    </div>
  );
}
