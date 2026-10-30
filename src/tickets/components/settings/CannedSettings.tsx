import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";

interface Canned {
  _id: string;
  title: string;
  body: string;
  isActive: boolean;
}

const EMPTY = { title: "", body: "" };

export default function CannedSettings() {
  const { list, save, remove } = useSettingsCrud<Canned>("canned");
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY);
  const reset = () => { setEditing(undefined); setForm(EMPTY); };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ id: editing, body: form }, { onSuccess: reset }); }}>
            <div className="space-y-1">
              <Label htmlFor="canned-title">Title</Label>
              <Input id="canned-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="canned-body">Reply text</Label>
              <Textarea id="canned-body" required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>{editing ? "Update Reply" : "Add Reply"}</Button>
              {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      {list.data?.map((reply) => (
        <Card key={reply._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="font-medium">{reply.title} {!reply.isActive && <Badge variant="outline">Inactive</Badge>}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(reply._id); setForm({ title: reply.title, body: reply.body }); }}>Edit</Button>
              {reply.isActive && <Button variant="ghost" size="sm" onClick={() => remove.mutate(reply._id)}>Deactivate</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
