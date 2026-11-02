import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Lock, Sparkles } from "lucide-react";
import { downloadFile } from "@/mcq/lib/api";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import type { TicketMeta } from "@/tickets/lib/types";
import Composer from "@/tickets/components/detail/Composer";

interface Props {
  controls: TicketControls;
  meta?: TicketMeta;
}

export default function DetailsTab({ controls, meta }: Props) {
  const { data, url, api, onError } = controls;
  const { token } = useAuth();
  const [summary, setSummary] = useState("");
  const summarize = useMutation({
    mutationFn: () => api.post<{ text: string }>(`${url}/ai/summary`),
    onSuccess: ({ text }) => setSummary(text),
    onError,
  });
  if (!data) return null;
  const { ticket, events, permissions } = data;
  const messages = events.filter((e) => e.kind === "comment" || e.kind === "note");
  const aiOn = permissions.manage && !!meta?.aiEnabled;

  return (
    <div className="space-y-4">
      {aiOn && (
        <Button variant="outline" size="sm" disabled={summarize.isPending} onClick={() => summarize.mutate()} data-testid="button-summarize">
          {summarize.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Summarize ticket
        </Button>
      )}
      {summary && (
        <Card className="border-primary/40" data-testid="card-ticket-summary">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap break-words">{summary}</CardContent>
        </Card>
      )}
      <Card><CardContent className="p-4 whitespace-pre-wrap break-words text-sm" data-testid="text-ticket-description">{ticket.description}</CardContent></Card>

      <section aria-label="Conversations" className="space-y-3">
        <h2 className="text-sm font-medium">Conversations</h2>
        {messages.length === 0 && <p className="text-sm text-muted-foreground">No replies yet</p>}
        <ol className="space-y-3">
          {messages.map((event) => (
            <li key={event._id} data-testid={`event-${event.kind}`}>
              <Card className={event.kind === "note" ? "border-amber-500/40 bg-amber-500/5" : ""}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    {event.kind === "note" && <Lock className="w-3 h-3" />}
                    <span className="font-medium text-foreground">{event.actorName}</span>
                    {event.kind === "note" && "internal note"} · {new Date(event.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-wrap break-words">{event.body}</p>
                  {event.attachments.map((file) => (
                    <Button key={file._id} variant="ghost" size="sm" className="h-auto p-1 underline" onClick={() => downloadFile(`${url}/attachments/${file._id}`, token).catch(onError)}>
                      <Download className="w-3 h-3 mr-1" />{file.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {!ticket.isArchived && <Composer controls={controls} meta={meta} />}
    </div>
  );
}
