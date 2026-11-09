export type AcademyFeature = "admissions" | "fees" | "lectures";

const FEATURE_ROLES: Record<AcademyFeature, string[]> = {
  admissions: ["org_admin", "manager"],
  fees: ["org_admin", "manager", "student"],
  lectures: ["org_admin", "manager", "teacher", "student"],
};

interface AcademyUser {
  role: string;
  organizationId?: { type?: string; features?: Partial<Record<string, boolean>> } | null;
  toolAccess?: { tickets?: boolean; crm?: boolean; mcq?: boolean; timeTracking?: boolean };
  permissions?: Record<string, boolean>;
}

// Org admins always have every tool; other members only the ones ticked on their Edit Member page.
// The superadmin has none: tickets and the CRM belong to each organization.
export type Tool = "tickets" | "crm";
export const hasTool = (user: AcademyUser | null | undefined, tool: Tool): boolean =>
  user?.role === "org_admin" || (user?.permissions ? user.permissions[tool] === true : user?.toolAccess?.[tool] === true);

// The read-only member directory (and, for managers and teachers, managing their people).
export const canSeeMembers = (user: AcademyUser | null | undefined): boolean =>
  user?.role === "org_admin" || (user?.role !== "member" && user?.role !== "superadmin" && user?.permissions?.members === true);
export const canUseTickets = (user: AcademyUser | null | undefined): boolean =>
  user?.organizationId?.features?.tickets !== false && hasTool(user, "tickets");

// Member access adds MCQ or Time Tracking to a person's own role. A "member" account has
// only what was ticked. MCQ access is decided in mcq/lib/roles.
export type MemberFeature = "mcq" | "timeTracking";
const TIME_TRACKING_ROLES = ["employee", "manager", "org_admin", "teacher"];
export const canUseTimeTracking = (user: AcademyUser | null | undefined): boolean =>
  featureOn(user, "timeTracking") && (user?.permissions
    ? user.permissions.timeTracking === true
    : TIME_TRACKING_ROLES.includes(user?.role || "") || user?.toolAccess?.timeTracking === true);

// The organization's feature switches (Super Admin / org admin). Missing means on.
export const featureOn = (user: AcademyUser | null | undefined, feature: string): boolean =>
  user?.organizationId?.features?.[feature] !== false;

// The person's own permission (role default, plus grants, minus revokes), as the server computed it.
// Before /me has loaded the map is absent and the role-based menu shows; the server decides either way.
export const permitted = (user: AcademyUser | null | undefined, key: string): boolean =>
  featureOn(user, key) && user?.permissions?.[key] !== false;


// Decides what's shown. The server enforces the same rules on every request.
export function canUseAcademy(user: AcademyUser | null | undefined, feature: AcademyFeature): boolean {
  const org = user?.organizationId;
  return org?.type === "academy" && permitted(user, feature) && FEATURE_ROLES[feature].includes(user?.role || "");
}

// Lecture-wise progress: staff follow their students, a student sees their own.
export const canUseProgress = (user: AcademyUser | null | undefined): boolean =>
  user?.organizationId?.type === "academy" && featureOn(user, "lectures") && ["org_admin", "manager", "teacher", "student"].includes(user?.role || "")
  && (user?.role === "org_admin" || user?.permissions?.studentProgress !== false);

// The CRM is for every organization type. Teachers and employees are telecallers
// and see only the leads assigned to them; admins and managers see all.
export const CRM_ROLES = ["org_admin", "manager", "teacher", "employee"];
export const TELECALLER_ROLES = ["teacher", "employee"];
export function canUseCrm(user: AcademyUser | null | undefined): boolean {
  return user?.organizationId?.features?.crm !== false && CRM_ROLES.includes(user?.role || "") && hasTool(user, "crm");
}

const LABELS: Record<string, string> = { nif_done: "NIF done" };
export const labelOf = (value: string) => {
  if (LABELS[value]) return LABELS[value];
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const toOptions = (values: readonly string[]) => values.map((value) => ({ value, label: labelOf(value) }));

export interface Person { _id: string; firstName?: string; lastName?: string; role?: string; username?: string }
export const nameOf = (person?: Person | null) => `${person?.firstName || ""} ${person?.lastName || ""}`.trim();
export const peopleOptions = (people: Person[] = []) => people.map((p) => ({ value: p._id, label: nameOf(p) || p.username || p._id }));

// Money is whole paise everywhere. Text is parsed by digits so 19.99 can't become 1998.
export function toMinor(text: string): number | null {
  const match = text.trim().match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

export const formatMoney = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
export const addDays = (value: string, days: number) => new Date(toDate(value).getTime() + days * 86400000).toISOString().slice(0, 10);
export const mondayOf = (value: string) => addDays(value, -((toDate(value).getUTCDay() + 6) % 7));
export const weekOf = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
export const dayLabel = (value: string) => toDate(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Lead statuses and stages as in Baker CRM. The server works out the stage from
// the status; the same map here only colours and groups the lists.
export type LeadStage = "cold" | "hot" | "dead";
export const LEAD_STAGES: Record<LeadStage, readonly string[]> = {
  cold: ["new", "not_answered", "busy", "visa_rejected"],
  hot: [
    "answered", "follow_up", "meeting_scheduled", "meeting_done", "agreement_pending", "agreement_done", "payment_pending",
    "payment_done", "documentation", "completed", "no_show", "appointment_booked", "visa_granted", "nif_done",
    "incorporation_done", "decision_pending", "endorsement_granted",
  ],
  dead: ["not_interested", "not_eligible", "wrong_number", "refunded"],
};
export const ENQUIRY_STATUSES = [...LEAD_STAGES.cold, ...LEAD_STAGES.hot, ...LEAD_STAGES.dead] as const;
const LEGACY_STAGE: Record<string, LeadStage> = { contacted: "hot", converted: "hot", lost: "dead" };
export const stageOf = (status: string): LeadStage =>
  (Object.keys(LEAD_STAGES) as LeadStage[]).find((stage) => LEAD_STAGES[stage].includes(status)) || LEGACY_STAGE[status] || "cold";
export const isOpenLead = (status: string) => stageOf(status) !== "dead" && !["completed", "converted"].includes(status);
export const STAGE_TONES: Record<LeadStage, string> = {
  cold: "bg-chart-1/10 text-chart-1",
  hot: "bg-chart-3/10 text-chart-3",
  dead: "bg-muted text-muted-foreground",
};
export const ENQUIRY_SOURCES = ["walk_in", "phone", "website", "referral", "social_media", "meta_ads", "instagram_ads", "google_ads", "whatsapp", "import", "other"] as const;
export const CALL_OUTCOMES = ["connected", "no_answer", "busy", "wrong_number", "call_back"] as const;
export const ADMISSION_STATUSES = ["applied", "approved", "rejected", "enrolled"] as const;
export const INVOICE_STATUSES = ["pending", "partial", "paid", "overdue"] as const;
export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"] as const;
export const LECTURE_STATUSES = ["scheduled", "completed", "cancelled"] as const;

export interface Course { _id: string; title: string }
export interface Batch { _id: string; batchName: string; courseId?: Course | null }

export type NoteKind = "note" | "call" | "discussion" | "whatsapp" | "status" | "assigned" | "followup";
export interface EnquiryNote { _id: string; body: string; kind?: NoteKind; outcome?: string; authorId?: string; authorName: string; createdAt: string; editedAt?: string }
export interface LeadTemplate { name: string; body: string }
// Previews a WhatsApp template for one lead; the server fills the same placeholders again before sending.
export const fillTemplate = (text: string, values: Record<string, string | undefined>) =>
  Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(value || ""), text);
export interface Enquiry {
  _id: string;
  campaign?: { name?: string; adSet?: string; ad?: string };
  name: string;
  phone: string;
  email: string;
  courseId?: Course | null;
  source: string;
  status: string;
  assignedTo?: Person | null;
  nextFollowUpDate: string;
  stage?: LeadStage;
  ticketId?: { _id: string; ticketKey: string; status: string } | null;
  notes?: EnquiryNote[];
  createdAt: string;
}
export interface EnquiryList { enquiries: Enquiry[]; total: number; pages: number; dueCount: number; stages: Record<LeadStage, number>; today: string }
export interface LeadReport {
  total: number;
  dueCount: number;
  stages: Record<LeadStage, number>;
  statuses: Record<string, number>;
  byAssignee: { assignedTo: string | null; name: string; total: number; open: number; hot: number }[];
}

export interface Admission {
  _id: string;
  enquiryId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentPhone: string;
  education: string;
  courseId?: Course | null;
  batchId?: Batch | null;
  status: string;
  notes: string;
  studentId?: Person | null;
  createdAt: string;
}
export interface AdmissionList { admissions: Admission[]; total: number; pages: number }
export interface EnrolResult {
  admission: Admission;
  student: { _id: string; username: string; name: string };
  tempPassword?: string;
  alreadyEnrolled?: boolean;
}

export interface FeePlan { _id: string; name: string; amountMinor: number; courseId?: Course | null; batchId?: Batch | null }
export interface Invoice {
  _id: string;
  invoiceKey: string;
  studentId: string;
  studentName: string;
  title: string;
  amountMinor: number;
  paidMinor: number;
  balanceMinor: number;
  dueDate: string;
  notes: string;
  status: string;
}
export interface InvoiceList { invoices: Invoice[]; total: number; pages: number }
export interface Payment {
  _id: string;
  receiptKey: string;
  kind: "payment" | "reversal";
  amountMinor: number;
  date: string;
  method: string;
  reference: string;
  notes?: string;
  recordedBy?: Person | null;
  reversed: boolean;
}
export interface InvoiceDetail extends Invoice { payments: Payment[] }
export interface Receipt extends Payment { invoice: { invoiceKey: string; title: string; studentName: string; amountMinor: number } }
export interface FeeReport {
  collectedMinor: number;
  byMethod: { method: string; netMinor: number }[];
  count: number;
  billedMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  overdueCount: number;
}

export interface Lecture {
  _id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
  notes: string;
  subject?: string;
  topicId?: { _id: string; title: string; subject?: string } | null;
  portion?: string;
  description?: string;
  batchId?: Batch | null;
  teacherId?: Person | null;
}
export interface CourseTopic { _id: string; title: string; subject: string; order: number }
