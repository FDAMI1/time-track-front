import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useMcqApi } from "@/mcq/lib/api";

interface Permission { key: string; group: string; label: string; hint: string; requires?: string; byRole: boolean; on: boolean }
interface PersonPermissionsResponse { person: { _id: string; role: string }; permissions: Permission[] }

interface Props {
  userId: string;
  // Set when the superadmin works on an organization; an org admin works on their own.
  organizationId?: string;
}

// One person's permissions: the server lists only what their role and the organization's
// switches allow, so Select All can never pick something the admin may not grant.
export default function PersonPermissions({ userId, organizationId }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const suffix = organizationId ? `?organizationId=${organizationId}` : "";
  const key = ["/api/tool-access/permissions", userId, organizationId || "mine"];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<PersonPermissionsResponse>(`/api/tool-access/permissions/${userId}${suffix}`) });
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const saved = useMemo(() => Object.fromEntries((data?.permissions || []).map((p) => [p.key, p.on])), [data]);
  useEffect(() => setDraft(saved), [saved]);

  const save = useMutation({
    mutationFn: () => api.put<PersonPermissionsResponse>(`/api/tool-access/permissions/${userId}${suffix}`, { permissions: draft, ...(organizationId ? { organizationId } : {}) }),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      queryClient.invalidateQueries({ queryKey: ["/api/tool-access"] });
      toast({ title: "Permissions saved", description: "They apply on this person's next click; no sign-out needed." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">Couldn't load permissions. Try again.</p>;
  if (!data.permissions.length) return <p className="text-sm text-muted-foreground">Nothing can be switched for this person: their organization has no matching features on.</p>;

  const groups = [...new Set(data.permissions.map((p) => p.group))];
  const dirty = data.permissions.some((p) => draft[p.key] !== p.on);
  const setAll = (on: boolean) => setDraft(Object.fromEntries(data.permissions.map((p) => [p.key, on])));
  const onCount = data.permissions.filter((p) => p.on).length;

  return (
    <div className="space-y-3" data-testid="person-permissions">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground" data-testid="text-permission-count">{onCount} of {data.permissions.length} switched on now</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setAll(true)} data-testid="button-permissions-select-all">Select All</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAll(false)} data-testid="button-permissions-deselect-all">Deselect All</Button>
        </div>
      </div>
      {groups.map((group) => (
        <fieldset key={group} className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.permissions.filter((p) => p.group === group).map((p) => {
              const blocked = !!p.requires && draft[p.requires] === false;
              return (
                <div key={p.key} className={`flex items-start justify-between gap-3 rounded-md border p-2 ${blocked ? "opacity-50" : ""}`}>
                  <label htmlFor={`perm-${p.key}`} className="text-sm min-w-0">
                    <span className="font-medium">{p.label}</span>
                    {p.byRole && <Badge variant="secondary" className="ml-1 text-[10px] align-middle">role default</Badge>}
                    <span className="block text-xs text-muted-foreground">{p.hint}</span>
                  </label>
                  <Switch id={`perm-${p.key}`} checked={!!draft[p.key] && !blocked} disabled={blocked} onCheckedChange={(on) => setDraft({ ...draft, [p.key]: on })} aria-label={p.label} data-testid={`switch-permission-${p.key}`} />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">Organisation management, user management and settings stay with the Admin role. A permission never shows other people's records beyond what the person is allowed to see.</p>
      <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="button-save-person-permissions">{save.isPending ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}
