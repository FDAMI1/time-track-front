import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgUsers } from "@/mcq/components/TestAssignDialogs";
import { userName } from "@/mcq/lib/types";
import { useSettingsCrud } from "@/tickets/lib/useSettingsCrud";

interface Group {
  _id: string;
  name: string;
  leadId?: string | null;
  memberIds: string[];
  departmentId?: string | null;
  isActive: boolean;
}

const EMPTY = { name: "", leadId: "none", departmentId: "none", memberIds: [] as string[] };

export default function GroupSettings() {
  const { list, save, remove } = useSettingsCrud<Group>("groups");
  const { data: users } = useOrgUsers();
  const { data: departments } = useQuery<{ _id: string; departmentName: string }[]>({ queryKey: ["/api/departments"] });
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY);
  const reset = () => { setEditing(undefined); setForm(EMPTY); };
  const staff = (users || []).filter((u) => u.role !== "student" && u.isActive !== false);

  const submit = () => save.mutate({
    id: editing,
    body: {
      name: form.name,
      memberIds: form.memberIds,
      leadId: form.leadId === "none" ? null : form.leadId,
      departmentId: form.departmentId === "none" ? null : form.departmentId,
    },
  }, { onSuccess: reset });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Group members become support agents for that group's tickets, whatever their role.</p>
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="group-name">Name</Label>
                <Input id="group-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-group-name" />
              </div>
              <div className="space-y-1">
                <Label>Group lead</Label>
                <Select value={form.leadId} onValueChange={(leadId) => setForm({ ...form, leadId })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lead</SelectItem>
                    {staff.map((u) => <SelectItem key={u._id} value={u._id}>{userName(u)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Department routing</Label>
                <Select value={form.departmentId} onValueChange={(departmentId) => setForm({ ...form, departmentId })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments?.map((d) => <SelectItem key={d._id} value={d._id}>{d.departmentName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Members</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {staff.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.memberIds.includes(u._id)}
                      onCheckedChange={(checked) => setForm({ ...form, memberIds: checked ? [...form.memberIds, u._id] : form.memberIds.filter((id) => id !== u._id) })}
                      data-testid={`checkbox-member-${u._id}`}
                    />
                    {userName(u)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending} data-testid="button-save-group">{editing ? "Update Group" : "Add Group"}</Button>
              {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      {list.data?.map((group) => (
        <Card key={group._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium">{group.name} {!group.isActive && <Badge variant="outline">Inactive</Badge>}</p>
              <p className="text-xs text-muted-foreground">{group.memberIds.length} members</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(group._id); setForm({ name: group.name, leadId: group.leadId || "none", departmentId: group.departmentId || "none", memberIds: group.memberIds }); }}>Edit</Button>
              {group.isActive
                ? <Button variant="ghost" size="sm" onClick={() => remove.mutate(group._id)}>Deactivate</Button>
                : <Button variant="ghost" size="sm" onClick={() => save.mutate({ id: group._id, body: { isActive: true } })}>Activate</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
