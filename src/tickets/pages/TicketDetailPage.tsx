import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Loader2, Lock } from "lucide-react";
import { downloadFile, useMcqApi } from "@/mcq/lib/api";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { capitalize, countdown, personName, PRIORITIES, PRIORITY_CLASSES, type TicketDetail, type TicketEvent, type TicketList } from "@/tickets/lib/types";

function eventText(event: TicketEvent, statusLabel: (key: string) => string) {
  const meta = event.meta || {};
  switch (event.kind) {
    case "created": return "created this ticket";
    case "status": return `changed status to ${statusLabel(String(meta.to))}`;
    case "assignment": return meta.reason === "sla_breach" ? "escalated this ticket after an SLA breach" : "changed the assignment";
    case "update": return `updated ${Object.keys((meta.changes as object) || {}).join(", ") || "the ticket"}`;
    case "related": return `${meta.linked ? "linked" : "unlinked"} ${String(meta.ticketKey)}`;
    case "reopened": return "reopened this ticket";
    case "archived": return "archived this ticket";
    case "sla": return event.body || "SLA event";
    case "automation": return `automation ran: ${event.body}`;
    default: return "";
  }
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useMcqApi();
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: meta } = useTicketMeta();
  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [relatedKey, setRelatedKey] = useState("");

  const url = `/api/tickets/${id}`;
  const { data, isLoading, error } = useQuery({
    queryKey: [url],
    queryFn: () => api.get<TicketDetail>(url),
    refetchInterval: 30000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [url] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets/reports/summary"] });
  };
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const action = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload?: unknown }) => api.post(`${url}/${path}`, payload),
    onSuccess: refresh,
    onError,
  });
  const update = useMutation({ mutationFn: (payload: unknown) => api.put(url, payload), onSuccess: refresh, onError });

  const reply = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("body", body);
      form.append("isNote", String(isNote));
      files.forEach((file) => form.append("files", file));
      return api.post(`${url}/replies`, form);
    },
    onSuccess: () => { setBody(""); setFiles([]); setIsNote(false); refresh(); },
    onError,
  });

  const link = useMutation({
    mutationFn: async () => {
      const found = await api.get<TicketList>(`/api/tickets?q=${encodeURIComponent(relatedKey.trim())}&limit=1`);
      if (!found.tickets[0]) throw new Error("Ticket not found");
      return api.post(`${url}/related`, { ticketId: found.tickets[0]._id });
    },
    onSuccess: () => { setRelatedKey(""); refresh(); },
    onError,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <p>This ticket doesn't exist or you don't have access to it.</p>
        <Link href="/" className="text-primary underline text-sm">Back to tickets</Link>
      </CardContent></Card>
    );
  }

  const { ticket, events, children, permissions } = data;
  const manage = permissions.manage;
  const statusLabel = (key: string) => meta?.statuses.find((s) => s.key === key)?.label || key;
  const running = ["open", "pending"].includes(ticket.statusType);
  const clocks = [
    { label: "First response", due: !ticket.firstResponseAt ? ticket.sla?.firstResponseDueAt : undefined },
    { label: "Resolution", due: ticket.sla?.resolutionDueAt },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Tickets</Link>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span className="text-sm font-mono text-muted-foreground" data-testid="text-ticket-key">{ticket.ticketKey}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>{capitalize(ticket.priority)}</span>
          <Badge variant="secondary" data-testid="badge-ticket-status">{statusLabel(ticket.status)}</Badge>
          {ticket.isArchived && <Badge variant="outline">Archived</Badge>}
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-1 break-words">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1">Raised by {ticket.requesterName} on {new Date(ticket.createdAt).toLocaleString()} via {capitalize(ticket.source.replace("_", " "))}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="p-4 whitespace-pre-wrap break-words text-sm">{ticket.description}</CardContent></Card>

          <ol className="space-y-3" aria-label="Ticket timeline">
            {events.map((event) => {
              const message = event.kind === "comment" || event.kind === "note";
              return (
                <li key={event._id} data-testid={`event-${event.kind}`}>
                  {message ? (
                    <Card className={event.kind === "note" ? "border-amber-500/40 bg-amber-500/5" : ""}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {event.kind === "note" && <Lock className="w-3 h-3" />}
                          <span className="font-medium text-foreground">{event.actorName}</span>
                          {event.kind === "note" && "internal note"} · {new Date(event.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm whitespace-pre-wrap break-words">{event.body}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">
                      <span className="font-medium">{event.actorName}</span> {eventText(event, statusLabel)} · {new Date(event.createdAt).toLocaleString()}
                    </p>
                  )}
                  {event.attachments.map((file) => (
                    <Button
                      key={file._id}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 underline"
                      onClick={() => downloadFile(`${url}/attachments/${file._id}`, token).catch(onError)}
                    >
                      <Download className="w-3 h-3 mr-1" />{file.name}
                    </Button>
                  ))}
                </li>
              );
            })}
          </ol>

          {!ticket.isArchived && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {manage && (meta?.canned.length || 0) > 0 && (
                  <Select value="" onValueChange={(v) => setBody((b) => `${b}${meta?.canned.find((c) => c._id === v)?.body || ""}`)}>
                    <SelectTrigger aria-label="Insert canned reply"><SelectValue placeholder="Insert canned reply" /></SelectTrigger>
                    <SelectContent>{meta?.canned.map((c) => <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Textarea rows={4} placeholder={isNote ? "Write an internal note" : "Write a reply"} aria-label="Reply" value={body} onChange={(e) => setBody(e.target.value)} data-testid="input-ticket-reply" />
                <Input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" aria-label="Attach files" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {manage ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={isNote} onCheckedChange={(checked) => setIsNote(!!checked)} data-testid="checkbox-internal-note" />
                      Internal note
                    </label>
                  ) : <span />}
                  <Button disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate()} data-testid="button-send-reply">
                    {reply.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{isNote ? "Add Note" : "Send Reply"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {ticket.sla?.resolutionDueAt && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">SLA</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!running && <p className="text-muted-foreground">Stopped</p>}
                {running && ticket.sla.pausedAt && <p className="text-muted-foreground">Paused</p>}
                {running && !ticket.sla.pausedAt && clocks.filter((c) => c.due).map((clock) => {
                  const left = countdown(clock.due);
                  return (
                    <div key={clock.label} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{clock.label}</span>
                      <span className={left?.overdue ? "text-destructive font-medium" : ""} data-testid={`sla-${clock.label.toLowerCase().replace(/\s+/g, "-")}`}>{left?.text}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {manage ? (
                <>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={ticket.status} onValueChange={(status) => action.mutate({ path: "status", payload: { status } })}>
                      <SelectTrigger data-testid="select-ticket-status"><SelectValue /></SelectTrigger>
                      <SelectContent>{meta?.statuses.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Priority</Label>
                    <Select value={ticket.priority} onValueChange={(priority) => update.mutate({ priority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Group</Label>
                    <Select value={ticket.groupId?._id || "none"} onValueChange={(v) => action.mutate({ path: "assign", payload: { groupId: v === "none" ? null : v, agentId: null } })}>
                      <SelectTrigger data-testid="select-ticket-group"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {meta?.groups.map((g) => <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Agent</Label>
                    <Select value={ticket.agentId?._id || "none"} onValueChange={(v) => action.mutate({ path: "assign", payload: { agentId: v === "none" ? null : v } })}>
                      <SelectTrigger data-testid="select-ticket-agent"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {meta?.agents.map((a) => <SelectItem key={a._id} value={a._id}>{personName(a) || a.username}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <p><span className="text-muted-foreground">Group: </span>{ticket.groupId?.name || "Not assigned yet"}</p>
                  <p><span className="text-muted-foreground">Agent: </span>{personName(ticket.agentId) || "Not assigned yet"}</p>
                </>
              )}
              <p><span className="text-muted-foreground">Category: </span>{ticket.categoryId?.name || "None"}{ticket.subcategory ? ` / ${ticket.subcategory}` : ""}</p>
              <p><span className="text-muted-foreground">Type: </span>{capitalize(ticket.type.replace("_", " "))}</p>
              {ticket.departmentId && <p><span className="text-muted-foreground">Department: </span>{ticket.departmentId.departmentName}</p>}
              {ticket.tags.length > 0 && <p className="flex gap-1 flex-wrap">{ticket.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</p>}
              {permissions.reopen && <Button variant="outline" className="w-full" onClick={() => action.mutate({ path: "reopen" })} data-testid="button-reopen-ticket">Reopen Ticket</Button>}
              {meta?.isAdmin && !ticket.isArchived && <Button variant="ghost" className="w-full" onClick={() => action.mutate({ path: "archive" })} data-testid="button-archive-ticket">Archive</Button>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Related Tickets</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[...(ticket.relatedIds || []), ...children].map((r) => (
                <Link key={r._id} href={`/${r._id}`} className="block truncate hover:underline">{r.ticketKey}: {r.subject}</Link>
              ))}
              {!(ticket.relatedIds?.length || children.length) && <p className="text-muted-foreground">None</p>}
              {manage && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); link.mutate(); }}>
                  <Input placeholder="TKT-000123" aria-label="Ticket number to link" value={relatedKey} onChange={(e) => setRelatedKey(e.target.value)} />
                  <Button type="submit" variant="outline" disabled={!relatedKey.trim() || link.isPending}>Link</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
