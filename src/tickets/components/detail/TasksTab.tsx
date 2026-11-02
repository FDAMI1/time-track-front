import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { TicketControls } from "@/tickets/lib/useTicketDetail";
import { personName, type TicketMeta } from "@/tickets/lib/types";

interface Props {
  controls: TicketControls;
  meta?: TicketMeta;
}

export default function TasksTab({ controls, meta }: Props) {
  const { data, action } = controls;
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("none");
  const [dueAt, setDueAt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  if (!data) return null;
  const tasks = data.tasks || [];
  const entries = data.timeEntries || [];
  const total = entries.reduce((sum, e) => sum + e.minutes, 0);

  const addTask = () => {
    action.mutate({ path: "tasks", payload: { title, assigneeId: assigneeId === "none" ? undefined : assigneeId, dueAt: dueAt || undefined } });
    setTitle("");
    setAssigneeId("none");
    setDueAt("");
  };
  const addTime = () => {
    action.mutate({ path: "time", payload: { minutes: Number(minutes), note } });
    setMinutes("");
    setNote("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tasks.length === 0 && <p className="text-muted-foreground">No tasks yet</p>}
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task._id} className="flex items-center gap-3" data-testid={`task-${task.status}`}>
                <Checkbox
                  checked={task.status === "done"}
                  aria-label={`Mark ${task.title} done`}
                  onCheckedChange={(checked) => action.mutate({ path: `tasks/${task._id}`, method: "put", payload: { status: checked ? "done" : "open" } })}
                  data-testid="checkbox-task"
                />
                <div className="min-w-0 flex-1">
                  <p className={`break-words ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {personName(task.assigneeId) || "Unassigned"}{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${task.title}`} onClick={() => action.mutate({ path: `tasks/${task._id}`, method: "delete" })}><Trash2 className="w-4 h-4" /></Button>
              </li>
            ))}
          </ul>
          <form className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_9rem_auto] gap-2" onSubmit={(e) => { e.preventDefault(); addTask(); }}>
            <Input required maxLength={200} placeholder="New task" aria-label="New task" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-task-title" />
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger aria-label="Assign task"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {meta?.agents.map((a) => <SelectItem key={a._id} value={a._id}>{personName(a) || a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" aria-label="Task due date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <Button type="submit" variant="outline" data-testid="button-add-task">Add Task</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Time Entries ({total} minutes)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {entries.length === 0 && <p className="text-muted-foreground">No time logged yet</p>}
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry._id} className="flex items-center gap-3" data-testid="time-entry">
                <div className="min-w-0 flex-1">
                  <p>{entry.minutes} minutes · {entry.agentName}</p>
                  {entry.note && <p className="text-xs text-muted-foreground break-words">{entry.note}</p>}
                </div>
                {(meta?.isAdmin || entry.agentId === user?._id) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove time entry" onClick={() => action.mutate({ path: `time/${entry._id}`, method: "delete" })}><Trash2 className="w-4 h-4" /></Button>
                )}
              </li>
            ))}
          </ul>
          <form className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); addTime(); }}>
            <Input required type="number" min={1} max={1440} placeholder="Minutes" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-testid="input-time-minutes" />
            <Input maxLength={500} placeholder="What was done (optional)" aria-label="Time note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" variant="outline" data-testid="button-add-time">Log Time</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
