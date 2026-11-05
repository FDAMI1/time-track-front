import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { labelOf, type EnquiryNote, type NoteKind } from "@/academy/lib/academy";

// People write notes, calls and discussions; the rest are recorded automatically and never change.
export const EDITABLE_KINDS: NoteKind[] = ["note", "call", "discussion"];

const LABELS: Record<NoteKind, (n: EnquiryNote) => string> = {
  note: () => "Note",
  call: (n) => `Call: ${labelOf(n.outcome || "")}`,
  discussion: () => "Discussion",
  whatsapp: () => "WhatsApp message",
  status: () => "Status changed",
  assigned: () => "Assigned to",
  followup: () => "Follow-up",
};

interface Props {
  notes: EnquiryNote[];
  kinds?: NoteKind[];
  empty: string;
  canEdit: (note: EnquiryNote) => boolean;
  onEdit: (noteId: string, body: string) => Promise<unknown>;
}

// One lead's history, newest first, filtered to the kinds a tab shows.
export default function LeadEntries({ notes, kinds, empty, canEdit, onEdit }: Props) {
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = [...notes].reverse().filter((n) => !kinds || kinds.includes(n.kind || "note"));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await onEdit(editing.id, editing.body);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {shown.map((n) => {
        const kind = n.kind || "note";
        const isEditing = editing?.id === n._id;
        return (
          <li key={n._id} className="rounded-lg bg-muted p-3 text-sm" data-testid={`note-${kind}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium">{LABELS[kind](n)}</p>
              {!isEditing && EDITABLE_KINDS.includes(kind) && canEdit(n) && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditing({ id: n._id, body: n.body })} data-testid={`button-edit-note-${n._id}`}>Edit</Button>
              )}
            </div>
            {isEditing ? (
              <form className="space-y-2 mt-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <Textarea rows={3} required maxLength={2000} aria-label="Edit entry" value={editing.body} onChange={(e) => setEditing({ id: n._id, body: e.target.value })} data-testid="input-edit-note" />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={saving || !editing.body.trim()} data-testid="button-save-note">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <p className="whitespace-pre-wrap break-words">{n.body}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {n.authorName} · {new Date(n.createdAt).toLocaleString()}{n.editedAt ? " · edited" : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
