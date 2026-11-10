import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Forward, Loader2, Reply, Sparkles, StickyNote } from "lucide-react";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import type { TicketMeta } from "@/tickets/lib/types";
import AttachmentDrop, { useAttachments } from "@/tickets/components/AttachmentDrop";

type Mode = "reply" | "note" | "forward";

interface Props {
  controls: TicketControls;
  meta?: TicketMeta;
}

// Reply, Forward and Add note. An AI draft only fills the box; the agent sends it.
export default function Composer({ controls, meta }: Props) {
  const { data, url, api, refresh, onError, toast } = controls;
  const [mode, setMode] = useState<Mode>("reply");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const attachments = useAttachments();
  const manage = !!data?.permissions.manage;
  const emailOn = !!meta?.emailEnabled;
  const aiOn = manage && !!meta?.aiEnabled;

  const reply = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("body", body);
      form.append("isNote", String(mode === "note"));
      attachments.files.forEach((file) => form.append("files", file));
      return api.post(`${url}/replies`, form);
    },
    onSuccess: () => { setBody(""); attachments.clear(); setMode("reply"); refresh(); },
    onError,
  });
  const forward = useMutation({
    mutationFn: () => api.post(`${url}/forward`, { to, note: body }),
    onSuccess: () => { setBody(""); setTo(""); setMode("reply"); refresh(); toast({ title: "Ticket forwarded" }); },
    onError,
  });
  const draft = useMutation({
    mutationFn: () => api.post<{ text: string }>(`${url}/ai/reply`),
    onSuccess: ({ text }) => { setMode("reply"); setBody(text); },
    onError,
  });

  const modeButton = (value: Mode, label: string, Icon: typeof Reply, testId: string, disabled = false) => (
    <Button type="button" variant={mode === value ? "default" : "outline"} size="sm" disabled={disabled} onClick={() => setMode(value)} data-testid={testId}>
      <Icon className="w-4 h-4 mr-2" />{label}
    </Button>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {manage && (
          <div className="flex items-center gap-2 flex-wrap">
            {modeButton("reply", "Reply", Reply, "button-reply")}
            {modeButton("forward", "Forward", Forward, "button-forward", !emailOn)}
            {modeButton("note", "Add note", StickyNote, "button-add-note")}
            {aiOn && (
              <Button type="button" variant="outline" size="sm" disabled={draft.isPending} onClick={() => draft.mutate()} data-testid="button-reply-ai">
                {draft.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Reply using AI
              </Button>
            )}
          </div>
        )}
        {manage && !emailOn && <p className="text-xs text-muted-foreground" data-testid="text-forward-off">Forward is off because email isn't set up on this server.</p>}
        {mode === "forward" && (
          <Input placeholder="Send to (email addresses, separated by commas)" aria-label="Send to" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-forward-to" />
        )}
        {manage && mode !== "forward" && (meta?.canned.length || 0) > 0 && (
          <Select value="" onValueChange={(v) => setBody((b) => `${b}${meta?.canned.find((c) => c._id === v)?.body || ""}`)}>
            <SelectTrigger aria-label="Insert canned reply"><SelectValue placeholder="Insert canned reply" /></SelectTrigger>
            <SelectContent>{meta?.canned.map((c) => <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Textarea
          rows={4}
          placeholder={mode === "note" ? "Write an internal note" : mode === "forward" ? "Add a message (optional)" : "Write a reply"}
          aria-label="Reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={mode === "forward" ? undefined : attachments.onPaste}
          data-testid="input-ticket-reply"
        />
        {mode !== "forward" && <AttachmentDrop attachments={attachments} />}
        <div className="flex justify-end">
          {mode === "forward" ? (
            <Button disabled={!to.trim() || forward.isPending} onClick={() => forward.mutate()} data-testid="button-send-forward">
              {forward.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send Forward
            </Button>
          ) : (
            <Button disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate()} data-testid="button-send-reply">
              {reply.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{mode === "note" ? "Add Note" : "Send Reply"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
