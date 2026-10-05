import { useAuth } from "@/lib/auth";
import { isMcqAdmin, isMcqStaff, isMcqTaker } from "@/mcq/lib/roles";
import AdminDashboard from "./dashboards/AdminDashboard";
import StaffDashboard from "./dashboards/StaffDashboard";
import TakerDashboard from "./dashboards/TakerDashboard";

export default function McqDashboardPage() {
  const { user } = useAuth();
  if (isMcqAdmin(user?.role)) return <AdminDashboard />;
  if (isMcqStaff(user?.role)) return <StaffDashboard />;
  if (isMcqTaker(user?.role)) return <TakerDashboard />;
  return <p className="text-muted-foreground text-sm">The MCQ module is not available for your role.</p>;
}
