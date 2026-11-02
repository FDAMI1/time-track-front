import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMcqApi } from "@/mcq/lib/api";
import { TICKET_TYPES } from "@/tickets/lib/types";

type Rules = Record<string, Record<string, Record<string, boolean>>>;

const URL = "/api/tickets/settings/config";
const STAGES = [{ key: "resolve", label: "Resolve" }, { key: "close", label: "Close" }];
const RULES = [
  { key: "timeEntry", label: "Time entry required" },
  { key: "tasksDone", label: "All tasks done" },
  { key: "childrenClosed", label: "Child tickets closed" },
];

export default function ClosureSettings() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: [URL], queryFn: () => api.get<{ closureRules: Rules }>(URL) });
  const [rules, setRules] = useState<Rules | null>(null);
  useEffect(() => { if (data) setRules(data.closureRules); }, [data]);

  const save = useMutation({
    mutationFn: () => api.put(URL, { closureRules: rules }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [URL] }); toast({ title: "Saved" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  if (!rules) return null;
  const set = (type: string, stage: string, rule: string, value: boolean) =>
    setRules({ ...rules, [type]: { ...rules[type], [stage]: { ...rules[type][stage], [rule]: value } } });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">A ticket can't be resolved or closed until these are met. This applies to every change, including bulk changes and automations.</p>
      {TICKET_TYPES.map((type) => (
        <Card key={type.value}>
          <CardHeader><CardTitle className="text-base">{type.label}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STAGES.map((stage) => (
              <div key={stage.key} className="space-y-3">
                <p className="text-sm font-medium">{stage.label} only if</p>
                {RULES.map((rule) => (
                  <label key={rule.key} className="flex items-center justify-between gap-4 text-sm">
                    {rule.label}
                    <Switch
                      checked={!!rules[type.value]?.[stage.key]?.[rule.key]}
                      onCheckedChange={(value) => set(type.value, stage.key, rule.key, value)}
                      aria-label={`${type.label}, ${stage.label}: ${rule.label}`}
                      data-testid={`switch-closure-${type.value}-${stage.key}-${rule.key}`}
                    />
                  </label>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-closure">Save Closure Rules</Button>
    </div>
  );
}
