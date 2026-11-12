import { useAuth } from "@/lib/auth";
import SuperAdminDashboard from "@/components/dashboards/superadmin-dashboard";
import OrgAdminDashboard from "@/components/dashboards/org-admin-dashboard";
import MemberDashboard from "@/components/dashboards/member-dashboard";
import { MobileGreeting } from "@/components/dashboards/mobile-greeting";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const dashboard = user.role === "superadmin" ? <SuperAdminDashboard /> : user.role === "org_admin" ? <OrgAdminDashboard /> : <MemberDashboard />;
  return (
    <>
      <MobileGreeting />
      {dashboard}
    </>
  );
}
