import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, LifeBuoy, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import NewTicketDialog from "@/tickets/components/NewTicketDialog";
import { capitalize, countdown, personName, PRIORITIES, PRIORITY_CLASSES, SCALE, SOURCES, TICKET_TYPES, type TicketList, type TicketSummary } from "@/tickets/lib/types";

const PAGE_SIZE = 25;
const FILTER_KEYS = ["q", "status", "statusType", "priority", "categoryId", "groupId", "agentId", "dueBy", "state", "urgency", "impact", "type", "source", "firstResponse", "tag", "from", "to"];

interface FilterProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterProps) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-full" aria-label={label} data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{`All: ${label}`}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const toOptions = (values: string[]) => values.map((value) => ({ value, label: capitalize(value) }));

export default function TicketsPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: meta } = useTicketMeta();
  const search = useSearch();
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries(new URLSearchParams(search)));
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const canSeeSummary = !!meta?.isAgent || user?.role === "manager";
  const canCreate = user?.role !== "superadmin";

  const setFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setSelected([]);
  };

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/tickets", params.toString()],
    queryFn: () => api.get<TicketList>(`/api/tickets?${params}`),
  });
  const { data: summary } = useQuery({
    queryKey: ["/api/tickets/reports/summary"],
    queryFn: () => api.get<TicketSummary>("/api/tickets/reports/summary"),
    enabled: canSeeSummary,
  });

  const bulk = useMutation({
    mutationFn: (body: { action: string; value?: string }) =>
      api.post<{ results: { ok: boolean }[] }>("/api/tickets/bulk", { ids: selected, ...body }),
    onSuccess: ({ results }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setSelected([]);
      const failed = results.filter((r) => !r.ok).length;
      toast({ title: `${results.length - failed} updated`, description: failed ? `${failed} could not be updated` : undefined, variant: failed ? "destructive" : "default" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusLabel = (key: string) => meta?.statuses.find((s) => s.key === key)?.label || key;
  const tiles: { label: string; value?: number; apply: Record<string, string> }[] = [
    { label: "Open", value: summary?.open, apply: { status: "open" } },
    { label: "Overdue", value: summary?.overdue, apply: { dueBy: "overdue" } },
    { label: "Due Today", value: summary?.dueToday, apply: { dueBy: "today" } },
    { label: "Unassigned", value: summary?.unassigned, apply: { agentId: "unassigned", state: "unresolved" } },
    { label: "Pending", value: summary?.pending, apply: { statusType: "pending" } },
  ];
  const tickets = data?.tickets || [];
  const allSelected = tickets.length > 0 && tickets.every((t) => selected.includes(t._id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} tickets</p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)} data-testid="button-new-ticket"><Plus className="w-4 h-4 mr-2" />New Ticket</Button>}
      </div>

      {canSeeSummary && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              className="rounded-lg border bg-card p-4 text-left hover:bg-accent transition-colors"
              onClick={() => { setFilters(tile.apply); setPage(1); setSelected([]); }}
              data-testid={`tile-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <p className="text-2xl font-bold">{tile.value ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search subject, ticket number or requester" aria-label="Search tickets" value={filters.q || ""} onChange={(e) => setFilter("q", e.target.value)} data-testid="input-ticket-search" />
          </div>
          <Button variant="outline" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-testid="button-more-filters">
            <SlidersHorizontal className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filters</span>
          </Button>
          {Object.values(filters).some(Boolean) && <Button variant="ghost" onClick={() => { setFilters({}); setPage(1); }}>Clear</Button>}
        </div>
        {moreOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)} options={(meta?.statuses || []).map((s) => ({ value: s.key, label: s.label }))} />
            <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilter("priority", v)} options={toOptions(PRIORITIES)} />
            <FilterSelect label="Category" value={filters.categoryId} onChange={(v) => setFilter("categoryId", v)} options={(meta?.categories || []).map((c) => ({ value: c._id, label: c.name }))} />
            <FilterSelect label="Type" value={filters.type} onChange={(v) => setFilter("type", v)} options={TICKET_TYPES} />
            <FilterSelect label="Source" value={filters.source} onChange={(v) => setFilter("source", v)} options={SOURCES} />
            <FilterSelect label="Urgency" value={filters.urgency} onChange={(v) => setFilter("urgency", v)} options={toOptions(SCALE)} />
            <FilterSelect label="Impact" value={filters.impact} onChange={(v) => setFilter("impact", v)} options={toOptions(SCALE)} />
            <FilterSelect label="Due by" value={filters.dueBy} onChange={(v) => setFilter("dueBy", v)} options={[{ value: "overdue", label: "Overdue" }, { value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }, { value: "next8h", label: "Next 8 hours" }]} />
            <FilterSelect label="First response" value={filters.firstResponse} onChange={(v) => setFilter("firstResponse", v)} options={[{ value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }]} />
            {meta?.isAgent && (
              <>
                <FilterSelect label="Group" value={filters.groupId} onChange={(v) => setFilter("groupId", v)} options={meta.groups.map((g) => ({ value: g._id, label: g.name }))} />
                <FilterSelect label="Agent" value={filters.agentId} onChange={(v) => setFilter("agentId", v)} options={[{ value: "me", label: "Me" }, { value: "unassigned", label: "Unassigned" }, ...meta.agents.map((a) => ({ value: a._id, label: personName(a) || a.username }))]} />
              </>
            )}
            <Input placeholder="Tag" aria-label="Tag" value={filters.tag || ""} onChange={(e) => setFilter("tag", e.target.value)} />
          </div>
        )}
      </div>

      {meta?.isAgent && selected.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/50 p-3" data-testid="bar-bulk">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="w-44">
            <Select value="" onValueChange={(value) => bulk.mutate({ action: "status", value })}>
              <SelectTrigger aria-label="Set status"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>{meta.statuses.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value="" onValueChange={(value) => bulk.mutate({ action: "priority", value })}>
              <SelectTrigger aria-label="Set priority"><SelectValue placeholder="Set priority" /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value="" onValueChange={(value) => bulk.mutate({ action: "assign_agent", value })}>
              <SelectTrigger aria-label="Assign agent"><SelectValue placeholder="Assign agent" /></SelectTrigger>
              <SelectContent>{meta.agents.map((a) => <SelectItem key={a._id} value={a._id}>{personName(a) || a.username}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {meta.isAdmin && <Button variant="outline" size="sm" onClick={() => bulk.mutate({ action: "archive" })}>Archive</Button>}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <LifeBuoy className="w-8 h-8 mx-auto mb-3" />
          <p>No tickets found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {meta?.isAgent && (
            <label className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelected(checked ? tickets.map((t) => t._id) : [])} aria-label="Select all tickets" />
              Select all
            </label>
          )}
          {tickets.map((ticket) => {
            const due = ["open", "pending"].includes(ticket.statusType) ? countdown(ticket.sla?.resolutionDueAt) : null;
            return (
              <Card key={ticket._id} data-testid={`card-ticket-${ticket.ticketKey}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  {meta?.isAgent && (
                    <Checkbox
                      className="mt-1"
                      checked={selected.includes(ticket._id)}
                      onCheckedChange={(checked) => setSelected((s) => (checked ? [...s, ticket._id] : s.filter((id) => id !== ticket._id)))}
                      aria-label={`Select ${ticket.ticketKey}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.ticketKey}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>{capitalize(ticket.priority)}</span>
                      <Badge variant="secondary">{statusLabel(ticket.status)}</Badge>
                      {due && <span className={`text-xs ${due.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{due.text}</span>}
                    </div>
                    <Link href={`/${ticket._id}`} className="block mt-1 font-medium truncate hover:underline">{ticket.subject}</Link>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {ticket.requesterName}
                      {ticket.categoryId?.name ? ` · ${ticket.categoryId.name}` : ""}
                      {` · ${personName(ticket.agentId) || ticket.groupId?.name || "Unassigned"}`}
                      {` · ${new Date(ticket.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(data?.pages || 1) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm">Page {page} of {data?.pages}</span>
          <Button variant="outline" size="icon" disabled={page >= (data?.pages || 1)} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      <NewTicketDialog open={createOpen} onOpenChange={setCreateOpen} meta={meta} />
    </div>
  );
}
