import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { labelOf, type MemberFeature, type Tool } from "@/academy/lib/academy";
import { useAuth } from "@/lib/auth";
import UserPermissionsPanel from "@/components/settings/UserPermissionsPanel";

type Key = Tool | MemberFeature | "crmTransfer";
interface Member { _id: string; firstName: string; lastName: string; username: string; role: string; toolAccess?: Partial<Record<Key, boolean>> }
type Update = { userId: string } & Partial<Record<Key, boolean>>;

// Member access columns add a module to the person's own role. MCQ exists only in academies,
// and a student already takes tests, so their MCQ switch is off.
const ALL_TOOLS: { key: Key; label: string; academyOnly?: boolean }[] = [
  { key: "tickets", label: "Tickets" },
  { key: "crm", label: "CRM" },
  { key: "crmTransfer", label: "Transfer leads" },
  { key: "mcq", label: "MCQ", academyOnly: true },
  { key: "timeTracking", label: "Time Tracking" },
];
const blocked = (m: Member, key: Key) => key === "mcq" && m.role === "student";
const URL = "/api/tool-access";

// The admin chooses which members get Tickets and the CRM. Admins always have both.
export default function ToolAccessCard() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const TOOLS = ALL_TOOLS.filter((t) => !t.academyOnly || user?.organizationId?.type === "academy");
  const { data: members, isLoading } = useQuery({ queryKey: [URL], queryFn: () => api.get<Member[]>(URL) });

  const save = useMutation({
    mutationFn: (updates: Update[]) => api.put<Member[]>(URL, { updates }),
    onSuccess: (list) => { queryClient.setQueryData([URL], list); queryClient.invalidateQueries({ queryKey: [URL, "mine"] }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setAll = (tool: Key, value: boolean) => {
    const targets = (members || []).filter((m) => !blocked(m, tool));
    if (targets.length) save.mutate(targets.map((m) => ({ userId: m._id, [tool]: value })));
  };

  return (
    <Card data-testid="card-tool-access">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" />Tool Access</CardTitle>
        <CardDescription>Choose which members can use Tickets and the CRM, and give Member access to MCQ or Time Tracking on top of a person's role. Admins always have everything. A Member account opens only the features switched on here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {user?.organizationId?.type && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">One person</h3>
            <UserPermissionsPanel orgType={user.organizationId.type} />
          </section>
        )}
        <h3 className="text-sm font-semibold">Everyone</h3>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {members && members.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
        {members && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Member</th>
                  {TOOLS.map((tool) => (
                    <th key={tool.key} className="py-2 pr-4 font-medium">
                      <div className="flex items-center gap-2">
                        {tool.label}
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={save.isPending} onClick={() => setAll(tool.key, true)} data-testid={`button-${tool.key}-all`}>All</Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={save.isPending} onClick={() => setAll(tool.key, false)} data-testid={`button-${tool.key}-none`}>None</Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id} className="border-t" data-testid={`row-tool-access-${m._id}`}>
                    <td className="py-2 pr-4">
                      <p className="font-medium">{`${m.firstName} ${m.lastName}`.trim() || m.username}</p>
                      <p className="text-xs text-muted-foreground">{labelOf(m.role)}</p>
                    </td>
                    {TOOLS.map((tool) => (
                      <td key={tool.key} className="py-2 pr-4">
                        <Switch
                          aria-label={`${tool.label} for ${m.firstName} ${m.lastName}`}
                          checked={m.toolAccess?.[tool.key] === true && !blocked(m, tool.key)}
                          disabled={save.isPending || blocked(m, tool.key)}
                          onCheckedChange={(value) => save.mutate([{ userId: m._id, [tool.key]: value }])}
                          data-testid={`switch-${tool.key}-${m._id}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
