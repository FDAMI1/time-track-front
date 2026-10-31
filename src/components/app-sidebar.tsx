import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RemoteImage } from "@/components/remote-image";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  CalendarOff,
  Settings,
  LogOut,
  Shield,
  GraduationCap,
  Briefcase,
  Timer,
  MessageCircle,
  Files,
  Receipt,
  ClipboardList,
  LifeBuoy,
  Bot,
  PhoneCall,
  UserPlus,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { canUseAcademy } from "@/academy/lib/academy";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  org_admin: "Organization Admin",
  teacher: "Teacher",
  student: "Student",
  manager: "Manager",
  employee: "Employee",
};

const roleBadgeVariants: Record<string, string> = {
  superadmin: "bg-primary/10 text-primary",
  org_admin: "bg-chart-2/10 text-chart-2",
  teacher: "bg-chart-3/10 text-chart-3",
  student: "bg-chart-4/10 text-chart-4",
  manager: "bg-chart-1/10 text-chart-1",
  employee: "bg-chart-5/10 text-chart-5",
};

function getBranding() {
  try {
    const saved = localStorage.getItem("app_theme");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

interface NavItem {
  group: string;
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Display order of the sidebar sections.
const NAV_GROUPS = ["Main", "People", "Attendance", "Academic", "Communication", "Records", "Platform", "Administration"];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [branding, setBranding] = useState(getBranding());
  useEffect(() => {
    const handler = () => setBranding(getBranding());
    window.addEventListener("brandingUpdated", handler);
    return () => window.removeEventListener("brandingUpdated", handler);
  }, []);

  if (!user) return null;

  const appName = branding.appName || user.organizationId?.name || "";
  const logoText = branding.logoText || "";
  const logoType = branding.logoType || "text";
  const logoUrl = branding.logoUrl || "";

  const initials = getInitials(user.firstName, user.lastName);
  const orgType = user.organizationId?.type;

  const getNavItems = () => {
    const items: NavItem[] = [];

    items.push({ group: "Main", title: "Dashboard", url: "/", icon: LayoutDashboard });

    if (user.role === "superadmin") {
      items.push({ group: "Platform", title: "Organizations", url: "/organizations", icon: Building2 });
      items.push({ group: "Communication", title: "Tickets", url: "/tickets", icon: LifeBuoy });
      items.push({ group: "Administration", title: "AI Assistant", url: "/assistant-admin", icon: Bot });
      items.push({ group: "Administration", title: "Settings", url: "/settings", icon: Settings });
    } else {
      if (["org_admin", "manager", "teacher"].includes(user.role)) {
        items.push({ group: "People", title: "Members", url: "/members", icon: Users });
      }
      items.push({ group: "Attendance", title: "Attendance", url: "/attendance", icon: CalendarCheck });
      items.push({ group: "Attendance", title: "Leave Requests", url: "/leaves", icon: CalendarOff });
      if (["employee", "manager", "org_admin", "teacher"].includes(user.role)) {
        items.push({ group: "Attendance", title: "Time Tracking", url: "/time-tracking", icon: Timer });
      }
      if (["org_admin", "teacher", "manager"].includes(user.role)) {
        if (orgType !== "company") {
          items.push({ group: "Communication", title: "WhatsApp", url: "/whatsapp", icon: MessageCircle });
        }
      }
      items.push({ group: "Records", title: "Documents", url: "/documents", icon: Files });
      items.push({ group: "Administration", title: "Settings", url: "/settings", icon: Settings });
      if (orgType === "company" && ["employee", "manager", "org_admin"].includes(user.role)) {
        items.push({ group: "Records", title: "Reimbursements", url: "/reimbursements", icon: Receipt });
      }
      if ((user.organizationId as any)?.features?.tickets !== false) {
        items.push({ group: "Communication", title: "Tickets", url: "/tickets", icon: LifeBuoy });
      }
      if (user.role === "org_admin") {
        items.push({ group: "Administration", title: "AI Assistant", url: "/assistant-admin", icon: Bot });
      }
      const chatEnabled = (user.organizationId as any)?.features?.chat !== false;
      if (chatEnabled) {
        items.push({ group: "Communication", title: "Chat", url: "/chat", icon: MessageCircle });
      }
      if (orgType === "academy") {
        items.push({ group: "Academic", title: "MCQ", url: "/mcq", icon: ClipboardList });
      }
      if (canUseAcademy(user, "enquiries")) items.push({ group: "Academic", title: "Enquiries", url: "/enquiries", icon: PhoneCall });
      if (canUseAcademy(user, "admissions")) items.push({ group: "Academic", title: "Admissions", url: "/admissions", icon: UserPlus });
      if (canUseAcademy(user, "fees")) items.push({ group: "Academic", title: "Fees", url: "/fees", icon: Wallet });
      if (canUseAcademy(user, "lectures")) items.push({ group: "Academic", title: "Lectures", url: "/lectures", icon: CalendarDays });
    }

    return items;
  };

  const navItems = getNavItems();
  const navGroups = NAV_GROUPS.map((label) => ({ label, items: navItems.filter((i) => i.group === label) })).filter((g) => g.items.length > 0);
  const OrgIcon = orgType === "academy" ? GraduationCap : orgType === "company" ? Briefcase : Shield;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 overflow-hidden ${logoType === "image" && logoUrl ? "bg-transparent" : "bg-primary text-primary-foreground"}`}>
            <RemoteImage
              src={logoType === "image" ? logoUrl : ""}
              alt="Logo"
              className="h-9 w-auto object-contain"
              fallback={logoText ? <span className="text-sm font-bold">{logoText}</span> : <Shield className="w-5 h-5" />}
            />
          </div>
          <span className="text-base font-bold tracking-tight truncate">{appName || "NF Skills"}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background px-3 py-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary shrink-0">
            <OrgIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">{user.organizationId?.name || "Platform"}</span>
            <span className="text-[11px] text-muted-foreground truncate">
              {orgType === "academy" ? "Academy" : orgType === "company" ? "Company" : "Super Admin"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="h-7 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="h-9 font-medium data-[active=true]:font-semibold"
                      isActive={["/mcq", "/tickets"].includes(item.url) ? location.startsWith(item.url) : location === item.url}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{user.firstName} {user.lastName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm w-fit ${roleBadgeVariants[user.role] || ""}`}>
              {user.role === "org_admin"
                ? orgType === "academy" ? "Academic Admin" : "Company Admin"
                : roleLabels[user.role]}
            </span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
