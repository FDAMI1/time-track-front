import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { isMcqStaff, isMcqTaker } from "@/mcq/lib/roles";
import { LayoutDashboard, BookOpen, ClipboardList, BarChart3, ExternalLink, TrendingUp, Settings } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const iconClass = "w-4 h-4";

function navFor(role: string | undefined): NavItem[] {
  if (isMcqStaff(role)) {
    return [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard className={iconClass} /> },
      { label: "Question Bank", href: "/questions", icon: <BookOpen className={iconClass} /> },
      { label: "Tests", href: "/tests", icon: <ClipboardList className={iconClass} /> },
      { label: "Results", href: "/results", icon: <BarChart3 className={iconClass} /> },
      { label: "External Results", href: "/external-results", icon: <ExternalLink className={iconClass} /> },
      { label: "Analytics", href: "/analytics", icon: <TrendingUp className={iconClass} /> },
      { label: "Settings", href: "/settings", icon: <Settings className={iconClass} /> },
    ];
  }
  if (isMcqTaker(role)) {
    return [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard className={iconClass} /> },
      { label: "My Tests", href: "/my-tests", icon: <ClipboardList className={iconClass} /> },
      { label: "Results", href: "/results", icon: <BarChart3 className={iconClass} /> },
    ];
  }
  return [];
}

// Wraps every MCQ page with a horizontal sub-navigation. Hrefs are relative to
// the nested /mcq router base.
export default function McqLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const items = navFor(user?.role);

  const isActive = (href: string) => (href === "/" ? location === "/" : location === href || location.startsWith(`${href}/`));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px" aria-label="MCQ sections" data-testid="nav-mcq">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-md border-b-2 -mb-px transition-colors ${
              isActive(item.href)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            data-testid={`link-mcq-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
