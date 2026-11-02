import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PersonPicker from "@/tickets/components/PersonPicker";
import { capitalize, MAJOR_INCIDENT_TYPES, personName, PRIORITIES, SCALE, SOURCES, TICKET_TYPES, type TicketMeta } from "@/tickets/lib/types";

interface OptionProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: OptionProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger className="w-full" aria-label={label} data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={id} type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid={id} />
    </div>
  );
}

const toOptions = (values: string[]) => values.map((value) => ({ value, label: capitalize(value) }));
const CREATED = [{ value: "24h", label: "Last 24 hours" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "6m", label: "Last 6 months" }];

interface Props {
  meta?: TicketMeta;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
}

export default function FilterPanel({ meta, filters, setFilter }: Props) {
  const bind = (key: string) => ({ value: filters[key], onChange: (value: string) => setFilter(key, value) });
  const agents = meta?.isAgent ? [{ value: "me_or_unassigned", label: "Me or unassigned" }, { value: "me", label: "Me" }, { value: "unassigned", label: "Unassigned" }, ...meta.agents.map((a) => ({ value: a._id, label: personName(a) || a.username }))] : [];

  return (
    <aside className="rounded-lg border bg-card p-3" aria-label="Ticket filters" data-testid="panel-filters">
      <Tabs defaultValue="basic">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic" data-testid="tab-filters-basic">Basic</TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-filters-advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="basic" className="space-y-3">
          {meta?.isAgent && <FilterSelect label="Agents" {...bind("agentId")} options={agents} />}
          <FilterSelect label="Created" {...bind("createdWithin")} options={CREATED} />
          <FilterSelect label="Status" {...bind("status")} options={(meta?.statuses || []).map((s) => ({ value: s.key, label: s.label }))} />
          {meta?.isAgent && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Requesters</Label>
                <PersonPicker label="Search a requester" testId="filter-requester" value={filters.requesterId ? { _id: filters.requesterId } : null} onChange={(p) => setFilter("requesterId", p?._id || "")} />
              </div>
              <FilterSelect label="Departments" {...bind("departmentId")} options={meta.departments.map((d) => ({ value: d._id, label: d.departmentName }))} />
              <FilterSelect label="Groups" {...bind("groupId")} options={meta.groups.map((g) => ({ value: g._id, label: g.name }))} />
              <DateFilter label="Planned Start From" {...bind("plannedStartFrom")} />
              <DateFilter label="Planned Start To" {...bind("plannedStartTo")} />
              <DateFilter label="Planned End From" {...bind("plannedEndFrom")} />
              <DateFilter label="Planned End To" {...bind("plannedEndTo")} />
            </>
          )}
        </TabsContent>
        <TabsContent value="advanced" className="space-y-3">
          <FilterSelect label="Due by" {...bind("dueBy")} options={[{ value: "overdue", label: "Overdue" }, { value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }, { value: "next8h", label: "Next 8 hours" }]} />
          <FilterSelect label="First response" {...bind("firstResponse")} options={[{ value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }]} />
          <FilterSelect label="Priority" {...bind("priority")} options={toOptions(PRIORITIES)} />
          <FilterSelect label="Urgency" {...bind("urgency")} options={toOptions(SCALE)} />
          <FilterSelect label="Impact" {...bind("impact")} options={toOptions(SCALE)} />
          <FilterSelect label="Type" {...bind("type")} options={TICKET_TYPES} />
          <FilterSelect label="Source" {...bind("source")} options={SOURCES} />
          <div className="space-y-1">
            <Label htmlFor="filter-tag" className="text-xs text-muted-foreground">Tags</Label>
            <Input id="filter-tag" value={filters.tag || ""} onChange={(e) => setFilter("tag", e.target.value)} />
          </div>
          <FilterSelect label="Category" {...bind("categoryId")} options={(meta?.categories || []).map((c) => ({ value: c._id, label: c.name }))} />
          {meta?.isAgent && <FilterSelect label="Major incident type" {...bind("majorIncidentType")} options={MAJOR_INCIDENT_TYPES} />}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
