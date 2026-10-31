export type AcademyFeature = "enquiries" | "admissions" | "fees" | "lectures";

const FEATURE_ROLES: Record<AcademyFeature, string[]> = {
  enquiries: ["org_admin", "manager", "teacher"],
  admissions: ["org_admin", "manager"],
  fees: ["org_admin", "manager", "student"],
  lectures: ["org_admin", "manager", "teacher", "student"],
};

interface AcademyUser {
  role: string;
  organizationId?: { type?: string; features?: Partial<Record<string, boolean>> } | null;
}

// Decides what's shown. The server enforces the same rules on every request.
export function canUseAcademy(user: AcademyUser | null | undefined, feature: AcademyFeature): boolean {
  const org = user?.organizationId;
  return org?.type === "academy" && org.features?.[feature] !== false && FEATURE_ROLES[feature].includes(user?.role || "");
}

export const labelOf = (value: string) => {
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

export const ENQUIRY_STATUSES = ["new", "contacted", "follow_up", "converted", "lost"] as const;
export const ENQUIRY_SOURCES = ["walk_in", "phone", "website", "referral", "social_media", "other"] as const;
export const ADMISSION_STATUSES = ["applied", "approved", "rejected", "enrolled"] as const;
export const INVOICE_STATUSES = ["pending", "partial", "paid", "overdue"] as const;
export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"] as const;
export const LECTURE_STATUSES = ["scheduled", "completed", "cancelled"] as const;

export interface Course { _id: string; title: string }
export interface Batch { _id: string; batchName: string; courseId?: Course | null }

export interface EnquiryNote { _id: string; body: string; authorName: string; createdAt: string }
export interface Enquiry {
  _id: string;
  name: string;
  phone: string;
  email: string;
  courseId?: Course | null;
  source: string;
  status: string;
  assignedTo?: Person | null;
  nextFollowUpDate: string;
  notes?: EnquiryNote[];
  createdAt: string;
}
export interface EnquiryList { enquiries: Enquiry[]; total: number; pages: number; dueCount: number; today: string }

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
  batchId?: Batch | null;
  teacherId?: Person | null;
}
