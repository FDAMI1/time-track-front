import { useAuth } from "@/lib/auth";
import SuperAdminDashboard from "@/components/dashboards/superadmin-dashboard";
import OrgAdminDashboard from "@/components/dashboards/org-admin-dashboard";
import MemberDashboard from "@/components/dashboards/member-dashboard";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case "superadmin":
      return <SuperAdminDashboard />;
    case "org_admin":
      return <OrgAdminDashboard />;
    default:
      return <MemberDashboard />;
  }
}
