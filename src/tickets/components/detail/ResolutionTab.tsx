import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";

export default function ResolutionTab({ controls }: { controls: TicketControls }) {
  const { data, update } = controls;
  const ticket = data?.ticket;
  const [notes, setNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  useEffect(() => {
    setNotes(ticket?.resolutionNotes || "");
    setPrivateNotes(ticket?.resolutionPrivateNotes || "");
  }, [ticket?.resolutionNotes, ticket?.resolutionPrivateNotes]);

  if (!data?.permissions.manage) {
    return (
      <Card><CardContent className="p-4 text-sm whitespace-pre-wrap break-words" data-testid="text-resolution">
        {ticket?.resolutionNotes || <span className="text-muted-foreground">No resolution notes yet</span>}
      </CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="resolution-notes">Resolution notes (the requester can read these)</Label>
          <Textarea id="resolution-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-resolution-notes" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="resolution-private">Private notes (agents only)</Label>
          <Textarea id="resolution-private" rows={3} value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} data-testid="input-resolution-private" />
        </div>
        <Button disabled={update.isPending} onClick={() => update.mutate({ resolutionNotes: notes, resolutionPrivateNotes: privateNotes })} data-testid="button-save-resolution">Save Resolution</Button>
      </CardContent>
    </Card>
  );
}
