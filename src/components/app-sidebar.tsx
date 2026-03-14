import { useAuth } from "@/lib/auth";
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
  BookOpen,
  Activity,
  MessagesSquare,
} from "lucide-react";

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

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const orgType = user.organizationId?.type;

  const getNavItems = () => {
    const items: { title: string; url: string; icon: any }[] = [];

    items.push({ title: "Dashboard", url: "/", icon: LayoutDashboard });

    if (user.role === "superadmin") {
      items.push({ title: "Organizations", url: "/organizations", icon: Building2 });
      items.push({ title: "Settings", url: "/settings", icon: Settings });
    } else {
      if (["org_admin", "manager", "teacher"].includes(user.role)) {
        items.push({ title: "Members", url: "/members", icon: Users });
      }
      items.push({ title: "Attendance", url: "/attendance", icon: CalendarCheck });
      items.push({ title: "Leave Requests", url: "/leaves", icon: CalendarOff });
      if (["employee", "manager", "org_admin"].includes(user.role) && orgType === "company") {
        items.push({ title: "Time Tracking", url: "/time-tracking", icon: Timer });
      }
      if (["org_admin", "teacher", "manager"].includes(user.role)) {
        items.push({ title: "Classes", url: "/classes", icon: BookOpen });
      }
      items.push({ title: "Chat", url: "/chat", icon: MessagesSquare });
      if (["org_admin", "teacher", "manager"].includes(user.role)) {
        items.push({ title: "Activity Logs", url: "/activity-logs", icon: Activity });
        items.push({ title: "WhatsApp", url: "/whatsapp", icon: MessageCircle });
        items.push({ title: "Settings", url: "/settings", icon: Settings });
      }
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">Unified Governance</span>
            <span className="text-xs text-muted-foreground truncate">
              {orgType === "academy" ? "Academy" : orgType === "company" ? "Company" : "Platform"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            {orgType === "academy" ? (
              <GraduationCap className="w-3.5 h-3.5" />
            ) : orgType === "company" ? (
              <Briefcase className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
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
              {roleLabels[user.role]}
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
