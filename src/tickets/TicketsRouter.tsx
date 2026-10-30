import { Switch, Route, Link, Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import TicketsPage from "@/tickets/pages/TicketsPage";
import TicketDetailPage from "@/tickets/pages/TicketDetailPage";
import TicketReportsPage from "@/tickets/pages/TicketReportsPage";
import TicketSettingsPage from "@/tickets/pages/TicketSettingsPage";

// Mounted by App.tsx as a nested route under /tickets. Backend authorization is enforced independently.
export default function TicketsRouter() {
  const { user } = useAuth();
  const { data: meta } = useTicketMeta();
  const [location] = useLocation();
  const reports = !!meta?.isAgent || user?.role === "manager";
  const settings = user?.role === "org_admin";

  const tabs = [
    { href: "/", label: "Tickets" },
    ...(reports ? [{ href: "/reports", label: "Reports" }] : []),
    ...(settings ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {tabs.length > 1 && (
        <nav className="flex gap-1 border-b" aria-label="Tickets">
          {tabs.map((tab) => {
            const active = tab.href === "/" ? !location.startsWith("/reports") && !location.startsWith("/settings") : location.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                data-testid={`tab-tickets-${tab.label.toLowerCase()}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}
      <Switch>
        <Route path="/" component={TicketsPage} />
        {reports && <Route path="/reports" component={TicketReportsPage} />}
        {settings && <Route path="/settings" component={TicketSettingsPage} />}
        <Route path="/:id" component={TicketDetailPage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    </div>
  );
}
