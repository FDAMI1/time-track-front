import { apiFetch } from "@/lib/api";
import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getInitials } from "@/lib/utils";
import { hasMcqAccess } from "@/mcq/lib/roles";
import { canUseAcademy, canUseCrm, canUseProgress, canUseTickets, canUseTimeTracking, featureOn, permitted } from "@/academy/lib/academy";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, LogOut, ShieldAlert } from "lucide-react";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import OrganizationsPage from "@/pages/organizations";
import MembersPage from "@/pages/members";
import AttendancePage from "@/pages/attendance";
import LeavesPage from "@/pages/leaves";
import SettingsPage from "@/pages/settings";
import WhatsappNotificationsPage from "@/pages/whatsapp-notifications";
import TimeTrackingPage from "@/pages/time-tracking";
import ClassesPage from "@/pages/classes";
import ActivityLogsPage from "@/pages/activity-logs";
import ChatPage from "@/pages/chat";
import DocumentTemplatesPage from "@/pages/document-templates";
import DocumentsPage from "@/pages/documents";
import RolesPermissionsPage from "@/pages/roles-permissions";
import SalarySetupPage from "@/pages/salary-setup";
import ReimbursementsPage from "@/pages/reimbursements";
import NotFound from "@/pages/not-found";
// MCQ module is code-split so it only loads when visited.
const McqRouter = lazy(() => import("@/mcq/McqRouter"));
const McqExternalTestPage = lazy(() => import("@/mcq/pages/McqExternalTestPage"));
const TicketsRouter = lazy(() => import("@/tickets/TicketsRouter"));
const EnquiriesPage = lazy(() => import("@/academy/pages/EnquiriesPage"));
const AdmissionsPage = lazy(() => import("@/academy/pages/AdmissionsPage"));
const FeesPage = lazy(() => import("@/academy/pages/FeesPage"));
const LecturesPage = lazy(() => import("@/academy/pages/LecturesPage"));
const ProgressPage = lazy(() => import("@/academy/pages/ProgressPage"));
const MemberProfilePage = lazy(() => import("@/pages/member-profile"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AssistantWidget = lazy(() => import("@/assistant/AssistantWidget"));
const GlobalTicketSearch = lazy(() => import("@/tickets/components/GlobalTicketSearch"));
const AssistantAdminPage = lazy(() => import("@/assistant/AssistantAdminPage"));
const McqFallback = () => (
  <div className="flex items-center justify-center p-12">
    <Skeleton className="h-8 w-48" />
  </div>
);
import ForcePasswordChange from "@/components/force-password-change";
import { applyBrandingCss, saveBranding, useBranding } from "@/lib/branding";
import { RemoteImage } from "@/components/remote-image";

function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: notifResponse } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { notifications: [], total: 0, unreadCount: 0 };
      const json = await res.json();
      if (Array.isArray(json)) return { notifications: json, total: json.length, unreadCount: json.filter((n: any) => !n.isRead).length };
      return json;
    },
    refetchInterval: 30000,
  });

  const notifications = notifResponse?.notifications || [];
  const unreadCount = notifResponse?.unreadCount ?? (notifications || []).filter((n: any) => !n.isRead).length;

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const markAllRead = async () => {
    await apiFetch("/api/notifications/read-all", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(!open)}
        data-testid="button-notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]" data-testid="badge-unread-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-popover border rounded-lg shadow-lg z-50" data-testid="dropdown-notifications">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-medium text-sm">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead} data-testid="button-mark-all-read">
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {(!notifications || notifications.length === 0) ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {(notifications || []).slice(0, 20).map((n: any) => (
                <div
                  key={n._id}
                  className={`p-3 text-sm cursor-pointer hover:bg-muted/50 ${!n.isRead ? "bg-primary/5" : ""}`}
                  onClick={() => { if (!n.isRead) markRead(n._id); }}
                  data-testid={`notification-item-${n._id}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  organizations: "Organizations",
  members: "Members",
  attendance: "Attendance",
  leaves: "Leave Requests",
  "time-tracking": "Time Tracking",
  whatsapp: "WhatsApp",
  classes: "Classes",
  "activity-logs": "Activity Logs",
  chat: "Chat",
  settings: "Settings",
  "document-templates": "Document Templates",
  documents: "Documents",
  "roles-permissions": "Roles & Permissions",
  "salary-setup": "Salary Setup",
  reimbursements: "Reimbursements",
  mcq: "MCQ",
  tickets: "Tickets",
  enquiries: "Leads",
  admissions: "Admissions",
  fees: "Fees",
  lectures: "Lectures",
  progress: "Student Progress",
  reports: "Reports",
  "assistant-admin": "AI Assistant",
};

// Page title with a breadcrumb, derived from the first URL segment.
// On phones the sidebar is closed, so the organization's logo also sits in the top bar.
function HeaderLogo() {
  const { logoType, logoUrl } = useBranding();
  if (logoType !== "image" || !logoUrl) return null;
  return <RemoteImage src={logoUrl} alt="Logo" className="md:hidden h-7 w-auto max-w-[96px] object-contain shrink-0" fallback={null} data-testid="img-header-logo" />;
}

function PageHeading() {
  const [location] = useLocation();
  const title = PAGE_TITLES[location.split("/")[1]];
  return (
    <div className="min-w-0 leading-tight">
      <h1 className="text-sm font-semibold truncate" data-testid="text-page-heading">{title || "Dashboard"}</h1>
      <p className="hidden sm:block text-xs text-muted-foreground truncate">Dashboard{title ? ` / ${title}` : ""}</p>
    </div>
  );
}

function ImpersonationBanner() {
  const { isImpersonating, exitImpersonation, impersonatedOrgName, user } = useAuth();
  if (!isImpersonating) return null;
  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm shrink-0" data-testid="banner-impersonation">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4" />
        <span>
          Viewing as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.role === "org_admin" ? "Admin" : user?.role}) — {impersonatedOrgName}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 bg-amber-600 border-amber-700 text-amber-50 hover:bg-amber-700 hover:text-white"
        onClick={exitImpersonation}
        data-testid="button-exit-impersonation"
      >
        <LogOut className="w-3.5 h-3.5 mr-1" />
        Back to Super Admin
      </Button>
    </div>
  );
}

function AuthenticatedRouter() {
  const { user, isImpersonating } = useAuth();
  const orgType = user?.organizationId?.type;

  // A member opens only the features their admin ticked; every other address is Not Found.
  if (user?.role === "member") {
    const home = canUseTimeTracking(user) ? "/time-tracking" : hasMcqAccess(user) ? "/mcq" : "/settings";
    return (
      <Switch>
        <Route path="/"><Redirect to={home} /></Route>
        {canUseTimeTracking(user) && <Route path="/time-tracking" component={TimeTrackingPage} />}
        {hasMcqAccess(user) && (
          <Route path="/mcq" nest>
            <Suspense fallback={<McqFallback />}><McqRouter /></Suspense>
          </Route>
        )}
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      {(user?.role === "superadmin" && !isImpersonating) && (
        <Route path="/organizations" component={OrganizationsPage} />
      )}
      {["org_admin", "manager", "teacher"].includes(user?.role || "") && (
        <Route path="/members" component={MembersPage} />
      )}
      {(user?.role === "org_admin" || user?.permissions?.performanceReports === true) && (
        <Route path="/reports">
          <Suspense fallback={<McqFallback />}><ReportsPage /></Suspense>
        </Route>
      )}
      {user?.role !== "superadmin" && (
        <Route path="/members/:id">
          <Suspense fallback={<McqFallback />}><MemberProfilePage /></Suspense>
        </Route>
      )}
      {user?.role !== "superadmin" && permitted(user, "attendance") && (
        <Route path="/attendance" component={AttendancePage} />
      )}
      {user?.role !== "superadmin" && permitted(user, "leaves") && (
        <Route path="/leaves" component={LeavesPage} />
      )}
      {canUseTimeTracking(user) && (
        <Route path="/time-tracking" component={TimeTrackingPage} />
      )}
      {["org_admin", "teacher", "manager"].includes(user?.role || "") && (
        <Route path="/whatsapp" component={WhatsappNotificationsPage} />
      )}
      {["org_admin", "teacher", "manager"].includes(user?.role || "") && featureOn(user, "classes") && (
        <Route path="/classes" component={ClassesPage} />
      )}
      {["org_admin", "teacher", "manager"].includes(user?.role || "") && (
        <Route path="/activity-logs" component={ActivityLogsPage} />
      )}
      {permitted(user, "chat") && <Route path="/chat" component={ChatPage} />}
      <Route path="/settings" component={SettingsPage} />
      {["org_admin", "teacher", "manager"].includes(user?.role || "") && (
        <Route path="/document-templates" component={DocumentTemplatesPage} />
      )}
      {user?.role !== "superadmin" && (
        <Route path="/documents" component={DocumentsPage} />
      )}
      {user?.role === "org_admin" && (
        <Route path="/roles-permissions" component={RolesPermissionsPage} />
      )}
      {user?.role === "org_admin" && (
        <Route path="/salary-setup" component={SalarySetupPage} />
      )}
      {["org_admin", "manager", "employee"].includes(user?.role || "") && permitted(user, "reimbursements") && (
        <Route path="/reimbursements" component={ReimbursementsPage} />
      )}
      {hasMcqAccess(user) && (
        <Route path="/mcq" nest>
          <Suspense fallback={<McqFallback />}><McqRouter /></Suspense>
        </Route>
      )}
      {["org_admin", "superadmin"].includes(user?.role || "") && (
        <Route path="/assistant-admin">
          <Suspense fallback={<McqFallback />}><AssistantAdminPage /></Suspense>
        </Route>
      )}
      {canUseCrm(user) && (
        <Route path="/enquiries">
          <Suspense fallback={<McqFallback />}><EnquiriesPage /></Suspense>
        </Route>
      )}
      {canUseAcademy(user, "admissions") && (
        <Route path="/admissions">
          <Suspense fallback={<McqFallback />}><AdmissionsPage /></Suspense>
        </Route>
      )}
      {canUseAcademy(user, "fees") && (
        <Route path="/fees">
          <Suspense fallback={<McqFallback />}><FeesPage /></Suspense>
        </Route>
      )}
      {canUseAcademy(user, "lectures") && (
        <Route path="/lectures">
          <Suspense fallback={<McqFallback />}><LecturesPage /></Suspense>
        </Route>
      )}
      {canUseProgress(user) && (
        <Route path="/progress">
          <Suspense fallback={<McqFallback />}><ProgressPage /></Suspense>
        </Route>
      )}
      {canUseTickets(user) && (
        <Route path="/tickets" nest>
          <Suspense fallback={<McqFallback />}><TicketsRouter /></Suspense>
        </Route>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const { user, token, isLoading, mustChangePassword } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem("app_theme");
    if (saved) {
      try { applyBrandingCss(JSON.parse(saved)); } catch {}
    }
    if (token && user?.organizationId) {
      apiFetch("/api/organizations/my/branding", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) saveBranding(data); })
        .catch(() => {});
    }
  }, [user?._id, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <ImpersonationBanner />
          <header className="flex items-center justify-between gap-3 px-4 border-b bg-card h-14 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <HeaderLogo />
              <PageHeading />
            </div>
            <div className="flex items-center gap-2">
              {canUseTickets(user) && (
                <Suspense fallback={null}><GlobalTicketSearch /></Suspense>
              )}
              <NotificationBell />
              <div className="flex items-center gap-2 pl-2 border-l">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  {getInitials(user.firstName, user.lastName)}
                </div>
                <span className="hidden sm:block text-sm font-medium max-w-[10rem] truncate">{user.firstName} {user.lastName}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <AuthenticatedRouter />
          </main>
        </div>
      </div>
      <Suspense fallback={null}><AssistantWidget key={user._id} /></Suspense>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Switch>
            <Route path="/mcq/external-test/:shareToken">
              <Suspense fallback={<McqFallback />}><McqExternalTestPage /></Suspense>
            </Route>
            <Route component={AppLayout} />
          </Switch>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
  