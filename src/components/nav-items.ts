import type { ComponentType } from "react";
import {
  LayoutDashboard, Building2, Users, CalendarCheck, CalendarOff, Settings, Timer, MessageCircle, Files, Receipt,
  ClipboardList, LifeBuoy, Bot, PhoneCall, UserPlus, Wallet, CalendarDays, TrendingUp, BarChart3,
} from "lucide-react";
import type { useAuth } from "@/lib/auth";
import { canSeeMembers, canUseAcademy, canUseCrm, canUseProgress, canUseTickets, canUseTimeTracking, permitted } from "@/academy/lib/academy";
import { hasMcqAccess } from "@/mcq/lib/roles";

export interface NavItem {
  group: string;
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
}

type User = NonNullable<ReturnType<typeof useAuth>["user"]>;

// Display order of the sidebar sections.
export const NAV_GROUPS = ["Main", "People", "Attendance", "CRM", "Academic", "Communication", "Records", "Platform", "Administration"];

// MCQ and Tickets have sub-pages; every other item matches its exact path.
export const isActivePath = (url: string, location: string) => (["/mcq", "/tickets"].includes(url) ? location.startsWith(url) : location === url);

// Everything a person may open, by role, organization type and permission. The sidebar and the
// phone's bottom bar both read this list, so neither can show a page the other hides.
export function navItemsFor(user: User): NavItem[] {
  const items: NavItem[] = [];
  const orgType = user.organizationId?.type;

  // A member sees only the features their admin ticked, plus Settings for their password.
  if (user.role === "member") {
    if (canUseTimeTracking(user)) items.push({ group: "Attendance", title: "Time Tracking", url: "/time-tracking", icon: Timer });
    if (hasMcqAccess(user)) items.push({ group: "Academic", title: "MCQ", url: "/mcq", icon: ClipboardList });
    if (canSeeMembers(user)) items.push({ group: "People", title: "Members", url: "/members", icon: Users });
    if (canUseCrm(user)) items.push({ group: "CRM", title: "Leads", url: "/enquiries", icon: PhoneCall });
    items.push({ group: "Communication", title: "Tickets", url: "/tickets", icon: LifeBuoy });
    if (permitted(user, "chat")) items.push({ group: "Communication", title: "Chat", url: "/chat", icon: MessageCircle });
    if (user.permissions?.performanceReports === true) items.push({ group: "Records", title: "Reports", url: "/reports", icon: BarChart3 });
    items.push({ group: "Administration", title: "Settings", url: "/settings", icon: Settings });
    return items;
  }

  items.push({ group: "Main", title: "Dashboard", url: "/", icon: LayoutDashboard });

  if (user.role === "superadmin") {
    items.push({ group: "Platform", title: "Organizations", url: "/organizations", icon: Building2 });
    items.push({ group: "Administration", title: "AI Assistant", url: "/assistant-admin", icon: Bot });
    items.push({ group: "Administration", title: "Settings", url: "/settings", icon: Settings });
    return items;
  }

  if (canSeeMembers(user)) items.push({ group: "People", title: "Members", url: "/members", icon: Users });
  if (permitted(user, "attendance")) items.push({ group: "Attendance", title: "Attendance", url: "/attendance", icon: CalendarCheck });
  if (permitted(user, "leaves")) items.push({ group: "Attendance", title: "Leave Requests", url: "/leaves", icon: CalendarOff });
  if (canUseTimeTracking(user)) items.push({ group: "Attendance", title: "Time Tracking", url: "/time-tracking", icon: Timer });
  if (["org_admin", "teacher", "manager"].includes(user.role) && permitted(user, "communication") && orgType !== "company") {
    items.push({ group: "Communication", title: "WhatsApp", url: "/whatsapp", icon: MessageCircle });
  }
  items.push({ group: "Records", title: "Documents", url: "/documents", icon: Files });
  if (user.role === "org_admin" || user.permissions?.performanceReports === true) items.push({ group: "Records", title: "Reports", url: "/reports", icon: BarChart3 });
  items.push({ group: "Administration", title: "Settings", url: "/settings", icon: Settings });
  if (orgType === "company" && ["employee", "manager", "org_admin"].includes(user.role) && permitted(user, "reimbursements")) {
    items.push({ group: "Records", title: "Reimbursements", url: "/reimbursements", icon: Receipt });
  }
  if (canUseTickets(user)) items.push({ group: "Communication", title: "Tickets", url: "/tickets", icon: LifeBuoy });
  if (user.role === "org_admin") items.push({ group: "Administration", title: "AI Assistant", url: "/assistant-admin", icon: Bot });
  if (permitted(user, "chat")) items.push({ group: "Communication", title: "Chat", url: "/chat", icon: MessageCircle });
  if (hasMcqAccess(user)) items.push({ group: "Academic", title: "MCQ", url: "/mcq", icon: ClipboardList });
  if (canUseCrm(user)) items.push({ group: "CRM", title: "Leads", url: "/enquiries", icon: PhoneCall });
  if (canUseAcademy(user, "admissions")) items.push({ group: "Academic", title: "Admissions", url: "/admissions", icon: UserPlus });
  if (canUseAcademy(user, "fees")) items.push({ group: "Academic", title: "Fees", url: "/fees", icon: Wallet });
  if (canUseAcademy(user, "lectures")) items.push({ group: "Academic", title: "Lectures", url: "/lectures", icon: CalendarDays });
  if (canUseProgress(user)) items.push({ group: "Academic", title: user.role === "student" ? "My Progress" : "Student Progress", url: "/progress", icon: TrendingUp });
  return items;
}

// The bottom bar's shortcuts: the first three of these the person can open, after Dashboard.
const SHORTCUT_ORDER = ["/time-tracking", "/attendance", "/mcq", "/lectures", "/enquiries", "/tickets", "/fees", "/members", "/leaves", "/chat", "/organizations", "/documents", "/settings"];

export function shortcutsFor(items: NavItem[]): NavItem[] {
  const home = items.find((i) => i.url === "/");
  const picks = SHORTCUT_ORDER.map((url) => items.find((i) => i.url === url)).filter((i): i is NavItem => !!i);
  return [...(home ? [home] : []), ...picks].slice(0, 4);
}
