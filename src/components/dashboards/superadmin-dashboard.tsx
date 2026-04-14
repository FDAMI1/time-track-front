import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Users, GraduationCap, Briefcase, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(217, 91%, 35%)", "hsl(142, 76%, 28%)", "hsl(271, 81%, 32%)", "hsl(37, 91%, 35%)"];

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [detailType, setDetailType] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/dashboard/superadmin"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard/superadmin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Academies", value: data?.academies || 0 },
    { name: "Companies", value: data?.companies || 0 },
  ];

  const detailTitles: Record<string, string> = {
    total_orgs: "All Organizations",
    active_orgs: "Active Organizations",
    total_users: "All Users",
    breakdown: "Academies & Companies",
  };

  function getDetailContent() {
    switch (detailType) {
      case "total_orgs":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data?.totalOrgs || 0} total organization(s) on the platform.</p>
            {(data?.recentOrgs || []).map((org: any) => (
              <div key={org._id} className="flex items-center justify-between p-3 rounded-md bg-muted/30" data-testid={`drilldown-org-${org._id}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center ${org.type === "academy" ? "bg-chart-4/10" : "bg-chart-1/10"}`}>
                    {org.type === "academy" ? <GraduationCap className="w-4 h-4 text-chart-4" /> : <Briefcase className="w-4 h-4 text-chart-1" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.isActive ? "Active" : "Inactive"} • Created {new Date(org.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize shrink-0">{org.type}</Badge>
              </div>
            ))}
          </div>
        );
      case "active_orgs":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data?.activeOrgs || 0} active organization(s).</p>
            {(data?.recentOrgs || []).filter((o: any) => o.isActive).map((org: any) => (
              <div key={org._id} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{org.type}</p>
                </div>
                <Badge className="bg-chart-2/10 text-chart-2">Active</Badge>
              </div>
            ))}
          </div>
        );
      case "total_users":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data?.totalUsers || 0} total users across all organizations (excluding superadmin).</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-md bg-primary/5 text-center">
                <p className="text-2xl font-bold">{data?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
              <div className="p-4 rounded-md bg-chart-2/10 text-center">
                <p className="text-2xl font-bold text-chart-2">{data?.totalOrgs || 0}</p>
                <p className="text-xs text-muted-foreground">Organizations</p>
              </div>
            </div>
          </div>
        );
      case "breakdown":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Organization type distribution.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-chart-4/10 text-center">
                <GraduationCap className="w-8 h-8 text-chart-4 mx-auto mb-2" />
                <p className="text-2xl font-bold">{data?.academies || 0}</p>
                <p className="text-xs text-muted-foreground">Academies</p>
              </div>
              <div className="p-4 rounded-md bg-chart-1/10 text-center">
                <Briefcase className="w-8 h-8 text-chart-1 mx-auto mb-2" />
                <p className="text-2xl font-bold">{data?.companies || 0}</p>
                <p className="text-xs text-muted-foreground">Companies</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Platform Overview</h1>
        <p className="text-muted-foreground">Manage all organizations and users across the platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("total_orgs")} data-testid="card-total-orgs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-sm text-muted-foreground">Total Organizations</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-total-orgs">{data?.totalOrgs || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("active_orgs")} data-testid="card-active-orgs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-sm text-muted-foreground">Active Organizations</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-active-orgs">{data?.activeOrgs || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("total_users")} data-testid="card-total-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-total-users">{data?.totalUsers || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-3/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailType("breakdown")} data-testid="card-breakdown">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className="text-sm text-muted-foreground">Academies / Companies</p>
                <p className="text-3xl font-bold mt-1">{data?.academies || 0} / {data?.companies || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-chart-4/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-sm text-muted-foreground">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.recentOrgs || []).map((org: any) => (
                <div key={org._id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center ${org.type === "academy" ? "bg-chart-4/10" : "bg-chart-1/10"}`}>
                      {org.type === "academy" ? (
                        <GraduationCap className="w-4 h-4 text-chart-4" />
                      ) : (
                        <Briefcase className="w-4 h-4 text-chart-1" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize shrink-0">
                    {org.type}
                  </Badge>
                </div>
              ))}
              {(!data?.recentOrgs || data.recentOrgs.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No organizations yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailType} onOpenChange={(open) => { if (!open) setDetailType(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-drilldown-title">{detailTitles[detailType || ""] || "Details"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {getDetailContent()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
