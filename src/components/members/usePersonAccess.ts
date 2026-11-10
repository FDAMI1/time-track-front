import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMcqApi } from "@/mcq/lib/api";
import type { AccessItem } from "@/components/members/AccessSwitches";

interface Response { person: { _id: string; role: string }; permissions: (AccessItem & { on: boolean })[] }

// One person's saved switches, loaded by their user ID for the Edit Member form. The form sends
// `value` with the rest of the member's details when it is saved, and only if it changed.
export function usePersonAccess(userId: string | null) {
  const api = useMcqApi();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/tool-access/permissions", userId],
    queryFn: () => api.get<Response>(`/api/tool-access/permissions/${userId}`),
    enabled: !!userId,
  });
  const saved = useMemo(() => (data?.permissions || []).filter((p) => p.on).map((p) => p.key), [data]);
  const [value, setValue] = useState<string[]>([]);
  useEffect(() => setValue(saved), [saved]);
  const dirty = [...value].sort().join() !== [...saved].sort().join();
  return { items: data?.permissions || [], value, setValue, dirty, loading: isLoading, failed: !!error };
}
