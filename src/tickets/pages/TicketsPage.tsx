import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BookOpen, ChevronLeft, ChevronRight, Download, LayoutGrid, LifeBuoy, List, Plus, Search, SlidersHorizontal } from "lucide-react";
import { downloadFile, useMcqApi } from "@/mcq/lib/api";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { BUILT_IN_VIEWS, viewFilters } from "@/tickets/lib/views";
import NewTicketDialog from "@/tickets/components/NewTicketDialog";
import TicketTable, { type Sort } from "@/tickets/components/list/TicketTable";
import TicketBoard from "@/tickets/components/list/TicketBoard";
import FilterPanel from "@/tickets/components/list/FilterPanel";
import ViewSwitcher from "@/tickets/components/list/ViewSwitcher";
import BulkBar from "@/tickets/components/list/BulkBar";
import type { TicketList, TicketView } from "@/tickets/lib/types";

const PAGE_SIZE = 50;
const BOARD_SIZE = 100;

const fromUrl = (search: string) => {
  const entries = Object.fromEntries(new URLSearchParams(search));
  return Object.keys(entries).length ? entries : null;
};

export default function TicketsPage() {
  const api = useMcqApi();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { data: meta } = useTicketMeta();
  const search = useSearch();
  const [chosen, setChosen] = useState<{ view: string; filters: Record<string, string> } | null>(() => {
    const filters = fromUrl(search);
    return filters ? { view: "custom", filters } : null;
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>({ key: "created", order: "desc" });
  const [layout, setLayout] = useState("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [selected, setSelected] = useState<string[]>([]);

  const staff = !!meta?.isAgent || user?.role === "manager";
  const canCreate = user?.role !== "superadmin";
  // Agents start on their queue; anyone else starts on everything they can see.
  const startView = meta?.isAgent ? "new_my_open" : "all";
  const view = chosen?.view ?? startView;
  const filters = chosen?.filters ?? viewFilters(startView) ?? {};
  const board = staff && layout === "board";

  // The top-bar search lands here with a new query while this page is already open.
  useEffect(() => {
    const filtersFromUrl = fromUrl(search);
    if (filtersFromUrl) { setChosen({ view: "custom", filters: filtersFromUrl }); setPage(1); }
  }, [search]);

  const choose = (nextView: string, nextFilters: Record<string, string>) => {
    setChosen({ view: nextView, filters: nextFilters });
    setPage(1);
    setSelected([]);
  };
  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (!value) delete next[key];
    choose("custom", next);
  };
  const toggleSort = (key: string) => {
    setSort((s) => ({ key, order: s.key === key && s.order === "desc" ? "asc" : "desc" }));
    setPage(1);
  };

  const filterParams = new URLSearchParams(filters);
  const params = new URLSearchParams({ page: String(board ? 1 : page), limit: String(board ? BOARD_SIZE : PAGE_SIZE), sort: sort.key, order: sort.order });
  filterParams.forEach((value, key) => params.set(key, value));

  const { data, isLoading } = useQuery({
    queryKey: ["/api/tickets", params.toString()],
    queryFn: () => api.get<TicketList>(`/api/tickets?${params}`),
    enabled: !!meta,
  });
  const { data: savedViews } = useQuery({ queryKey: ["/api/tickets/views"], queryFn: () => api.get<TicketView[]>("/api/tickets/views"), enabled: staff });

  const tickets = data?.tickets || [];
  const title = staff
    ? BUILT_IN_VIEWS.find((v) => v.key === view)?.name || savedViews?.find((v) => v._id === view)?.name || "Tickets"
    : "My Tickets";
  const exportList = () => downloadFile(`/api/tickets/reports/export?${filterParams}`, token)
    .catch((err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }));

  const list = isLoading || !data ? (
    <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  ) : tickets.length === 0 ? (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <LifeBuoy className="w-8 h-8 mx-auto mb-3" />
      <p>No tickets found</p>
    </CardContent></Card>
  ) : board && meta ? (
    <TicketBoard tickets={tickets} meta={meta} />
  ) : (
    <TicketTable tickets={tickets} meta={meta} sort={sort} onSort={toggleSort} selected={meta?.isAgent ? selected : undefined} onSelect={meta?.isAgent ? setSelected : undefined} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground break-words">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} tickets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {staff && <Button variant="outline" onClick={exportList} data-testid="button-export-list"><Download className="w-4 h-4 mr-2" />Export</Button>}
          {canCreate && staff && <Button onClick={() => setCreateOpen(true)} data-testid="button-new-ticket"><Plus className="w-4 h-4 mr-2" />New Ticket</Button>}
        </div>
      </div>

      {!staff && canCreate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="portal-start">
          <Link href="/help" className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors flex items-center gap-3" data-testid="link-help-articles">
            <BookOpen className="w-5 h-5 text-primary shrink-0" /><span className="font-medium">Browse help articles</span>
          </Link>
          <button type="button" className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors flex items-center gap-3 text-left" onClick={() => setCreateOpen(true)} data-testid="button-new-ticket">
            <Plus className="w-5 h-5 text-primary shrink-0" /><span className="font-medium">Report an issue</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {staff && <ViewSwitcher view={view} filters={filters} canSave={canCreate} onChoose={choose} />}
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search subject, ticket number or requester" aria-label="Search tickets" value={filters.q || ""} onChange={(e) => setFilter("q", e.target.value)} data-testid="input-ticket-search" />
        </div>
        {staff && (
          <>
            <ToggleGroup type="single" variant="outline" value={layout} onValueChange={(v) => v && setLayout(v)} aria-label="Layout">
              <ToggleGroupItem value="list" aria-label="List" data-testid="button-layout-list"><List className="w-4 h-4" /></ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board" data-testid="button-layout-board"><LayoutGrid className="w-4 h-4" /></ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen} data-testid="button-more-filters">
              <SlidersHorizontal className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filters</span>
            </Button>
          </>
        )}
        {Object.keys(filters).length > 0 && <Button variant="ghost" onClick={() => choose("all", {})}>Clear</Button>}
      </div>

      {meta?.isAgent && selected.length > 0 && !board && <BulkBar meta={meta} selected={selected} onDone={() => setSelected([])} />}

      <div className={staff && panelOpen ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-4 items-start" : ""}>
        <div className="min-w-0 space-y-4 order-2 lg:order-1">
          {list}
          {!board && (data?.pages || 1) > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm">Page {page} of {data?.pages}</span>
              <Button variant="outline" size="icon" disabled={page >= (data?.pages || 1)} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
        {staff && panelOpen && <div className="order-1 lg:order-2 min-w-0"><FilterPanel meta={meta} filters={filters} setFilter={setFilter} /></div>}
      </div>

      <NewTicketDialog open={createOpen} onOpenChange={setCreateOpen} meta={meta} />
    </div>
  );
}
