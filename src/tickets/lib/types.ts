export type StatusType = "open" | "pending" | "resolved" | "closed";

export interface TicketStatus {
  key: string;
  label: string;
  type: StatusType;
  isActive?: boolean;
}

export interface NamedRef {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  departmentName?: string;
}

export interface TicketSla {
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  pausedAt?: string;
  firstResponseBreachedAt?: string;
  resolutionBreachedAt?: string;
}

export interface TicketLink {
  _id: string;
  ticketKey: string;
  subject: string;
  status: string;
}

export interface MajorIncident {
  incidentType?: string;
  businessImpact?: string;
  impactedLocations?: string;
  customersImpacted?: number;
}

export type CustomValue = string | number | boolean;

export interface TicketField {
  _id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  options: string[];
  required: boolean;
  agentOnly: boolean;
  ticketTypes: string[];
  section?: string;
  order?: number;
  isActive?: boolean;
}

export interface TicketTask {
  _id: string;
  title: string;
  status: "open" | "done";
  assigneeId?: NamedRef | null;
  dueAt?: string | null;
}

export interface TicketTimeEntry {
  _id: string;
  agentId: string;
  agentName: string;
  minutes: number;
  note?: string;
  createdAt: string;
}

export interface RequesterInfo {
  _id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  departmentId?: { departmentName?: string } | null;
}

export interface TicketView {
  _id: string;
  name: string;
  filters: Record<string, string>;
}

export interface TicketDashboard {
  open: number;
  onHold: number;
  unassigned: number;
  overdue: number;
  dueToday: number;
  watching: number;
  byPriority: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
}

export interface Ticket {
  _id: string;
  ticketKey: string;
  subject: string;
  description?: string;
  requesterName: string;
  requesterId: string;
  type: string;
  priority: string;
  urgency?: string;
  impact?: string;
  status: string;
  statusType: StatusType;
  source: string;
  subcategory?: string;
  tags: string[];
  categoryId?: NamedRef | null;
  groupId?: NamedRef | null;
  agentId?: NamedRef | null;
  departmentId?: NamedRef | null;
  relatedIds?: TicketLink[];
  parentId?: TicketLink | null;
  cc?: NamedRef[];
  watchers?: NamedRef[];
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedEffort?: string;
  majorIncident?: MajorIncident;
  resolutionNotes?: string;
  resolutionPrivateNotes?: string;
  customFields?: Record<string, CustomValue>;
  firstResponseAt?: string;
  resolvedAt?: string;
  reopenCount: number;
  isArchived: boolean;
  sla?: TicketSla;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAttachment {
  _id: string;
  name: string;
  size: number;
}

export interface TicketEvent {
  _id: string;
  kind: string;
  actorName: string;
  body?: string;
  meta?: Record<string, unknown>;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  children: TicketLink[];
  tasks?: TicketTask[];
  timeEntries?: TicketTimeEntry[];
  requester?: RequesterInfo | null;
  permissions: { manage: boolean; reply: boolean; reopen: boolean; watching: boolean };
}

export interface TicketMeta {
  isAgent: boolean;
  isAdmin: boolean;
  statuses: TicketStatus[];
  matrixEnabled?: boolean;
  categories: { _id: string; name: string; subcategories: string[] }[];
  groups: { _id: string; name: string; memberIds: string[]; leadId?: string }[];
  agents: { _id: string; firstName: string; lastName: string; username: string }[];
  assignees?: { _id: string; firstName: string; lastName: string; username: string }[];
  canned: { _id: string; title: string; body: string }[];
  departments: { _id: string; departmentName: string }[];
  fields: TicketField[];
  scenarios: { _id: string; name: string; description?: string }[];
  emailEnabled?: boolean;
  aiEnabled?: boolean;
}

export interface TicketList {
  tickets: Ticket[];
  total: number;
  page: number;
  pages: number;
}

export interface TicketSummary {
  total: number;
  open?: number;
  inProgress?: number;
  pending?: number;
  resolved?: number;
  overdue?: number;
  dueToday?: number;
  unassigned?: number;
  breaches?: number;
  avgFirstResponseMs?: number | null;
  avgResolutionMs?: number | null;
  byPriority: { _id: string; count: number }[];
  byCategory: { name: string; count: number }[];
  byDepartment: { name: string; count: number }[];
  byAgent: { name: string; count: number }[];
}

export const PRIORITIES = ["low", "medium", "high", "urgent"];
export const SCALE = ["low", "medium", "high"];
export const TICKET_TYPES = [
  { value: "incident", label: "Incident" },
  { value: "service_request", label: "Service Request" },
  { value: "major_incident", label: "Major Incident" },
];
export const AGENT_SOURCES = [
  { value: "portal", label: "Portal" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "walk_up", label: "Walk-up" },
  { value: "feedback_widget", label: "Feedback Widget" },
  { value: "slack", label: "Slack" },
  { value: "ms_teams", label: "MS Teams" },
  { value: "other", label: "Other" },
];
export const SOURCES = [...AGENT_SOURCES, { value: "assistant", label: "Assistant" }];
export const MAJOR_INCIDENT_TYPES = [
  { value: "full_outage", label: "Full outage" },
  { value: "partial_outage", label: "Partial outage" },
  { value: "performance_degradation", label: "Performance degradation" },
  { value: "status_page_incident", label: "Status page incident" },
];

export const sourceLabel = (value: string) => SOURCES.find((s) => s.value === value)?.label || value;
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const personName = (p?: NamedRef | null) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "");

export const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-chart-1/10 text-chart-1",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  urgent: "bg-destructive/10 text-destructive",
};

export function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return "Not enough data";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

// The list's State column: where a ticket stands against its deadline, not its status.
export function ticketState(ticket: Ticket, now = Date.now()) {
  if (ticket.statusType === "resolved") return { label: "Resolved", className: "text-muted-foreground" };
  if (ticket.statusType === "closed") return { label: "Closed", className: "text-muted-foreground" };
  if (ticket.statusType === "pending") return { label: "On hold", className: "text-amber-600 dark:text-amber-400" };
  const due = ticket.sla?.resolutionDueAt ? new Date(ticket.sla.resolutionDueAt) : null;
  if (due && due.getTime() < now) return { label: "Overdue", className: "text-destructive font-medium" };
  if (due && due.toDateString() === new Date(now).toDateString()) return { label: "Due today", className: "text-amber-600 dark:text-amber-400" };
  return { label: ticket.firstResponseAt ? "Open" : "New", className: "text-foreground" };
}

// "2h 10m left" or "3d 1h overdue"
export function countdown(due?: string, now = Date.now()) {
  if (!due) return null;
  const diff = new Date(due).getTime() - now;
  return { overdue: diff < 0, text: `${formatDuration(Math.abs(diff))} ${diff < 0 ? "overdue" : "left"}` };
}
