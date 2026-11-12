import { useBranding } from "@/lib/branding";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RemoteImage } from "@/components/remote-image";
import { LogOut, Shield, GraduationCap, Briefcase } from "lucide-react";
import { NAV_GROUPS, isActivePath, navItemsFor } from "@/components/nav-items";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  org_admin: "Organization Admin",
  teacher: "Teacher",
  student: "Student",
  manager: "Manager",
  employee: "Employee",
  member: "Member",
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
  const { setOpenMobile } = useSidebar();
  const branding = useBranding();

  if (!user) return null;

  const appName = branding.appName || user.organizationId?.name || "";
  const logoText = branding.logoText || "";
  const logoType = branding.logoType || "text";
  const logoUrl = branding.logoUrl || "";

  const initials = getInitials(user.firstName, user.lastName);
  const orgType = user.organizationId?.type;

  const navItems = navItemsFor(user);
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
            <SidebarGroupLabel className="h-7 text-xs font-medium text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="h-9 font-medium data-[active=true]:font-semibold"
                      isActive={isActivePath(item.url, location)}
                    >
                      <Link href={item.url} onClick={() => setOpenMobile(false)} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
