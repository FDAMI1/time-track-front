import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMcqApi } from "@/mcq/lib/api";
import AccessSwitches, { type AccessItem } from "@/components/members/AccessSwitches";

interface PersonPermissionsResponse { person: { _id: string; role: string }; permissions: (AccessItem & { on: boolean })[] }

interface Props {
  userId: string;
}

// One person's switches on Edit Member. The server lists only what their role and the
// organization's switches allow, and saves exactly what is ticked.
export default function PersonPermissions({ userId }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const key = ["/api/tool-access/permissions", userId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<PersonPermissionsResponse>(`/api/tool-access/permissions/${userId}`) });

  const saved = useMemo(() => (data?.permissions || []).filter((p) => p.on).map((p) => p.key), [data]);
  const [draft, setDraft] = useState<string[]>([]);
  useEffect(() => setDraft(saved), [saved]);

  const save = useMutation({
    mutationFn: () => api.put<PersonPermissionsResponse>(`/api/tool-access/permissions/${userId}`, { access: draft }),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      toast({ title: "Permissions saved", description: "They apply on this person's next click; no sign-out needed." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">Couldn't load permissions. Try again.</p>;
  if (!data.permissions.length) return <p className="text-sm text-muted-foreground">Nothing can be switched for this person: their organization has no matching features on.</p>;

  const dirty = [...draft].sort().join() !== [...saved].sort().join();
  return (
    <div className="space-y-3" data-testid="person-permissions">
      <AccessSwitches items={data.permissions} value={draft} onChange={setDraft} disabled={save.isPending} />
      <p className="text-xs text-muted-foreground">Organisation management, user management and settings stay with the Admin role. A permission never shows other people's records beyond what the person is allowed to see.</p>
      <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="button-save-person-permissions">{save.isPending ? "Saving..." : "Save Permissions"}</Button>
    </div>
  );
}
