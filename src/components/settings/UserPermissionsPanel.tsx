import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { labelOf } from "@/academy/lib/academy";

type Flag = "tickets" | "crm" | "crmTransfer" | "mcq" | "timeTracking";
interface Person {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  role: string;
  managerId?: string | null;
  toolAccess?: Partial<Record<Flag, boolean>>;
}
type Draft = Record<Flag, boolean> & { managerId: string };

// Who this screen assigns work to. Students are never listed here.
const ROLES: Record<string, string[]> = { academy: ["teacher", "member"], company: ["manager", "employee"] };
const FLAGS: { key: Flag; label: string; hint: string; academyOnly?: boolean }[] = [
  { key: "tickets", label: "Tickets", hint: "Raise and work their own tickets" },
  { key: "crm", label: "CRM (Leads)", hint: "Work the leads assigned to them" },
  { key: "crmTransfer", label: "Transfer leads", hint: "Hand their own leads to a colleague" },
  { key: "mcq", label: "MCQ", hint: "Question bank, tests and results", academyOnly: true },
  { key: "timeTracking", label: "Time Tracking", hint: "Log their working time" },
];
// A Member account opens only MCQ and Time Tracking; the server refuses everything else.
const flagsFor = (role: string, orgType: string) =>
  FLAGS.filter((f) => (!f.academyOnly || orgType === "academy") && (role !== "member" || f.key === "mcq" || f.key === "timeTracking"));
const NONE: string[] = [];
const nameOf = (p: Person) => `${p.firstName} ${p.lastName}`.trim() || p.username;
const draftOf = (p: Person): Draft => ({
  tickets: !!p.toolAccess?.tickets, crm: !!p.toolAccess?.crm, crmTransfer: !!p.toolAccess?.crmTransfer,
  mcq: !!p.toolAccess?.mcq, timeTracking: !!p.toolAccess?.timeTracking, managerId: p.managerId || "",
});

interface Props {
  orgType: string;
  // Set when the superadmin works on an organization; an org admin works on their own.
  organizationId?: string;
}

// Pick one existing person, see what they can open, and change it.
export default function UserPermissionsPanel({ orgType, organizationId }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const url = organizationId ? `/api/tool-access?organizationId=${organizationId}` : "/api/tool-access";
  const { data: everyone } = useQuery({ queryKey: ["/api/tool-access", organizationId || "mine"], queryFn: () => api.get<Person[]>(url) });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const roles = ROLES[orgType] || NONE;
  const people = useMemo(() => (everyone || []).filter((p) => roles.includes(p.role)), [everyone, roles]);
  const presentRoles = roles.filter((r) => people.some((p) => p.role === r));
  const managers = people.filter((p) => p.role === "manager");
  const term = search.trim().toLowerCase();
  const matches = people.filter((p) => (!roleFilter || p.role === roleFilter) && (!term || `${nameOf(p)} ${p.username} ${p.email || ""}`.toLowerCase().includes(term)));
  const selected = people.find((p) => p._id === selectedId);

  const choose = (p: Person) => { setSelectedId(p._id); setDraft(draftOf(p)); };
  const save = useMutation({
    mutationFn: () => {
      if (!selected || !draft) throw new Error("Choose a person first");
      const flags = Object.fromEntries(flagsFor(selected.role, orgType).map((f) => [f.key, f.key === "crmTransfer" ? draft.crm && draft.crmTransfer : draft[f.key]]));
      const update = { userId: selected._id, ...flags, ...(selected.role === "employee" ? { managerId: draft.managerId || null } : {}) };
      return api.put<Person[]>("/api/tool-access", { updates: [update], ...(organizationId ? { organizationId } : {}) });
    },
    onSuccess: (list) => {
      queryClient.setQueryData(["/api/tool-access", organizationId || "mine"], list);
      queryClient.invalidateQueries({ queryKey: ["/api/tool-access"], exact: true });
      const fresh = list.find((p) => p._id === selectedId);
      if (fresh) setDraft(draftOf(fresh));
      toast({ title: "Permissions saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!everyone) return null;
  if (presentRoles.length === 0) {
    return <p className="text-sm text-muted-foreground">No {roles.map((r) => labelOf(r).toLowerCase() + "s").join(" or ")} yet. Add them on the Members page first.</p>;
  }
  const access = selected ? flagsFor(selected.role, orgType).filter((f) => selected.toolAccess?.[f.key]) : [];
  const supervised = selected?.role === "manager" ? people.filter((p) => p.role === "employee" && p.managerId === selected._id).length : 0;
  const dirty = !!selected && !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(selected));

  return (
    <div className="space-y-3" data-testid="user-permissions">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, username or email" aria-label="Search people" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-permission-search" />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by role">
          <Button type="button" size="sm" variant={roleFilter ? "outline" : "secondary"} onClick={() => setRoleFilter("")}>All</Button>
          {presentRoles.map((r) => (
            <Button key={r} type="button" size="sm" variant={roleFilter === r ? "secondary" : "outline"} onClick={() => setRoleFilter(r)} data-testid={`button-permission-role-${r}`}>{labelOf(r)}s</Button>
          ))}
        </div>
      </div>

      <ul className="max-h-48 overflow-y-auto rounded-md border divide-y" role="listbox" aria-label="People" data-testid="list-permission-people">
        {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No one matches</li>}
        {matches.map((p) => (
          <li key={p._id} role="option" aria-selected={p._id === selectedId}>
            <button type="button" onClick={() => choose(p)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${p._id === selectedId ? "bg-muted" : ""}`} data-testid={`option-person-${p._id}`}>
              <span className="min-w-0 truncate">{nameOf(p)} <span className="text-muted-foreground">@{p.username}</span></span>
              <Badge variant="secondary" className="text-xs shrink-0">{labelOf(p.role)}</Badge>
            </button>
          </li>
        ))}
      </ul>

      {selected && draft && (
        <div className="rounded-lg border p-3 space-y-3" data-testid="selected-person">
          <div>
            <p className="font-medium">{nameOf(selected)} <Badge variant="secondary" className="ml-1 text-xs">{labelOf(selected.role)}</Badge></p>
            <p className="text-xs text-muted-foreground break-all">{selected.email || `@${selected.username}`}</p>
            <p className="text-xs mt-1" data-testid="text-current-access">
              Can open now: {access.length ? access.map((f) => f.label).join(", ") : "nothing extra"}
              {selected.role === "manager" && ` · supervises ${supervised} employee${supervised === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {flagsFor(selected.role, orgType).map((f) => (
              <label key={f.key} className={`flex items-start gap-2 rounded-md border p-2 text-sm ${f.key === "crmTransfer" && !draft.crm ? "opacity-50" : ""}`}>
                <Checkbox className="mt-0.5" checked={draft[f.key]} disabled={f.key === "crmTransfer" && !draft.crm} onCheckedChange={(on) => setDraft({ ...draft, [f.key]: !!on })} data-testid={`checkbox-permission-${f.key}`} />
                <span><span className="font-medium">{f.label}</span><span className="block text-xs text-muted-foreground">{f.hint}</span></span>
              </label>
            ))}
          </div>
          {selected.role === "employee" && (
            <div className="space-y-1 max-w-xs">
              <Label>Reports to</Label>
              <Select value={draft.managerId || "none"} onValueChange={(v) => setDraft({ ...draft, managerId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-permission-manager"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {managers.map((m) => <SelectItem key={m._id} value={m._id}>{nameOf(m)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Their manager sees and supervises their leads and tickets.</p>
            </div>
          )}
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="button-save-permissions">{save.isPending ? "Saving..." : "Save Changes"}</Button>
        </div>
      )}
    </div>
  );
}
