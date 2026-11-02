import { capitalize, personName, PRIORITIES, type TicketMeta } from "@/tickets/lib/types";

// What automation rules and scenarios can do.
export const ACTIONS = [
  { value: "notify_admins", label: "Notify admins" },
  { value: "notify_lead", label: "Notify group lead" },
  { value: "notify_user", label: "Notify an agent" },
  { value: "set_priority", label: "Set priority" },
  { value: "set_status", label: "Set status" },
  { value: "assign_group", label: "Assign group" },
  { value: "assign_agent", label: "Assign agent" },
  { value: "add_tag", label: "Add tag" },
];

// The choices for an action or condition field, or null when it takes none.
export function actionOptions(key: string, meta?: TicketMeta) {
  if (key === "priority" || key === "set_priority") return PRIORITIES.map((p) => ({ value: p, label: capitalize(p) }));
  if (key === "status" || key === "set_status") return (meta?.statuses || []).map((s) => ({ value: s.key, label: s.label }));
  if (key === "categoryId") return (meta?.categories || []).map((c) => ({ value: c._id, label: c.name }));
  if (key === "groupId" || key === "assign_group") return (meta?.groups || []).map((g) => ({ value: g._id, label: g.name }));
  if (key === "assign_agent" || key === "notify_user") return (meta?.agents || []).map((a) => ({ value: a._id, label: personName(a) || a.username }));
  return null;
}
