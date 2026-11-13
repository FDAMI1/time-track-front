import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImage } from "@/components/remote-image";
import { localToday } from "@/academy/lib/academy";
import { ATTENDANCE_LABEL, person, type RecoveryTopic } from "@/academy/lib/progress";

const EMPTY = { date: localToday(), startTime: "", durationMinutes: "", topicTaught: "", notes: "" };

// Topics students missed (absent, or check-in denied) that still need a recovery lecture. Recording one
// completes the topic for that student only; the original lecture and its absence stay as they were.
export default function RecoveryPanel({ batchId }: { batchId: string }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const key = ["/api/progress/recovery", batchId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<RecoveryTopic[]>(`/api/progress/recovery${batchId ? `?batchId=${batchId}` : ""}`),
  });
  const save = useMutation({
    mutationFn: (topicId: string) => api.post(`/api/progress/recovery/${topicId}`, { ...form, durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : 0 }),
    onSuccess: () => {
      ["/api/progress/recovery", "/api/progress", "/api/progress/students"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setOpenFor(null);
      toast({ title: "Recovery completed", description: "The topic is completed for this student. The original absence is kept." });
    },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground p-6 text-center border rounded-md" data-testid="text-no-recovery">No pending recovery topics.</p>;

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y" data-testid="list-recovery">
          {data.map((t) => {
            const s = t.studentId;
            const l = t.originalLectureId;
            return (
              <li key={t._id} className="p-3 space-y-2" data-testid={`row-recovery-${t._id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 text-xs font-semibold">
                      <RemoteImage src={s?.photoUrl || ""} alt={person(s)} className="w-full h-full object-cover" fallback={<span>{(s?.firstName?.[0] || "") + (s?.lastName?.[0] || "")}</span>} />
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{person(s)}{s?.userId ? <span className="text-xs text-muted-foreground font-normal"> · ID {s.userId}</span> : null}</p>
                      <p>{l?.title || t.topicTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {[l?.subject || t.subject, l?.portion, l?.batchId?.batchName].filter(Boolean).join(" · ")}
                        {` · ${t.originalDate}`}{t.lecturerId ? ` · ${person(t.lecturerId)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-destructive">{ATTENDANCE_LABEL[t.attendanceStatus]}</Badge>
                    <Badge variant="outline" className="text-amber-600">Recovery Required</Badge>
                    {openFor !== t._id && (
                      <Button size="sm" variant="outline" onClick={() => { setOpenFor(t._id); setForm({ ...EMPTY, date: localToday(), topicTaught: t.topicTitle }); }} data-testid={`button-recover-${t._id}`}>
                        Record recovery
                      </Button>
                    )}
                  </div>
                </div>
                {openFor === t._id && (
                  <form className="grid grid-cols-2 sm:grid-cols-4 gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(t._id); }}>
                    <Input type="date" min={t.originalDate} max={localToday()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Recovery date" data-testid="input-recovery-date" />
                    <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} aria-label="Recovery start time" data-testid="input-recovery-time" />
                    <Input type="number" min={0} max={600} placeholder="Minutes" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} aria-label="Recovery duration in minutes" data-testid="input-recovery-minutes" />
                    <Input placeholder="Topic taught" value={form.topicTaught} onChange={(e) => setForm({ ...form, topicTaught: e.target.value })} aria-label="Topic taught" data-testid="input-recovery-topic" />
                    <Input className="col-span-2 sm:col-span-4" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label="Recovery notes" />
                    <div className="col-span-2 sm:col-span-4 flex gap-2">
                      <Button type="submit" size="sm" disabled={save.isPending} data-testid="button-save-recovery">Complete recovery</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpenFor(null)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
