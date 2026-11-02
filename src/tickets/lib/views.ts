// Named queues every agent starts with. A user's own views are stored on the server.
export const BUILT_IN_VIEWS: { key: string; name: string; filters: Record<string, string> }[] = [
  { key: "new_my_open", name: "New & My Open Tickets", filters: { agentId: "me_or_unassigned", state: "unresolved" } },
  { key: "all", name: "All Tickets", filters: {} },
  { key: "my_open", name: "My Open Tickets", filters: { agentId: "me", state: "unresolved" } },
  { key: "unassigned", name: "Unassigned Tickets", filters: { agentId: "unassigned", state: "unresolved" } },
  { key: "overdue", name: "Overdue Tickets", filters: { dueBy: "overdue" } },
  { key: "due_today", name: "Tickets Due Today", filters: { dueBy: "today" } },
  { key: "on_hold", name: "Tickets On Hold", filters: { statusType: "pending" } },
  { key: "watching", name: "Tickets I'm Watching", filters: { watching: "true" } },
  { key: "closed", name: "Closed Tickets", filters: { statusType: "closed" } },
];

export const viewFilters = (key: string) => BUILT_IN_VIEWS.find((v) => v.key === key)?.filters;
