import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";

interface Category {
  _id: string;
  name: string;
  subcategories: string[];
  groupId?: string | null;
  isActive: boolean;
}

const EMPTY = { name: "", subcategories: "", groupId: "none" };

export default function CategorySettings() {
  const { list, save, remove } = useSettingsCrud<Category>("categories");
  const { data: meta } = useTicketMeta();
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY);
  const reset = () => { setEditing(undefined); setForm(EMPTY); };

  const submit = () => {
    const body = {
      name: form.name,
      subcategories: form.subcategories.split(",").map((s) => s.trim()).filter(Boolean),
      groupId: form.groupId === "none" ? null : form.groupId,
    };
    save.mutate({ id: editing, body }, { onSuccess: reset });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="space-y-1">
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-category-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-subs">Subcategories, separated by commas</Label>
              <Input id="category-subs" value={form.subcategories} onChange={(e) => setForm({ ...form, subcategories: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Route new tickets to</Label>
              <Select value={form.groupId} onValueChange={(groupId) => setForm({ ...form, groupId })}>
                <SelectTrigger data-testid="select-category-group"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No automatic routing</SelectItem>
                  {meta?.groups.map((g) => <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex gap-2">
              <Button type="submit" disabled={save.isPending} data-testid="button-save-category">{editing ? "Update Category" : "Add Category"}</Button>
              {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      {list.data?.map((category) => (
        <Card key={category._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium">{category.name} {!category.isActive && <Badge variant="outline">Inactive</Badge>}</p>
              <p className="text-xs text-muted-foreground truncate">{category.subcategories.join(", ") || "No subcategories"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(category._id); setForm({ name: category.name, subcategories: category.subcategories.join(", "), groupId: category.groupId || "none" }); }}>Edit</Button>
              {category.isActive
                ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(category._id)}>Deactivate</Button>
                : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: category._id, body: { isActive: true } })}>Activate</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
