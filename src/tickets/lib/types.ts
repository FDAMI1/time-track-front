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
  relatedIds?: { _id: string; ticketKey: string; subject: string; status: string }[];
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
  children: { _id: string; ticketKey: string; subject: string; status: string }[];
  permissions: { manage: boolean; reply: boolean; reopen: boolean };
}

export interface TicketMeta {
  isAgent: boolean;
  isAdmin: boolean;
  statuses: TicketStatus[];
  matrixEnabled?: boolean;
  categories: { _id: string; name: string; subcategories: string[] }[];
  groups: { _id: string; name: string; memberIds: string[]; leadId?: string }[];
  agents: { _id: string; firstName: string; lastName: string; username: string }[];
  canned: { _id: string; title: string; body: string }[];
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
export const SOURCES = [
  { value: "portal", label: "Portal" },
  { value: "assistant", label: "Assistant" },
  { value: "phone", label: "Phone" },
  { value: "walk_up", label: "Walk-up" },
];

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

// "2h 10m left" or "3d 1h overdue"
export function countdown(due?: string, now = Date.now()) {
  if (!due) return null;
  const diff = new Date(due).getTime() - now;
  return { overdue: diff < 0, text: `${formatDuration(Math.abs(diff))} ${diff < 0 ? "overdue" : "left"}` };
}
