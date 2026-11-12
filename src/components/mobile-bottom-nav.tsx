import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/components/ui/sidebar";
import { isActivePath, navItemsFor, shortcutsFor } from "@/components/nav-items";

const itemClass = "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium min-w-0 transition-colors";

// Phones only: Dashboard plus the person's three main modules, and More for the full menu (the
// sidebar drawer). Built from the same list as the sidebar, so it follows the same permissions.
export function MobileBottomNav() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { setOpenMobile } = useSidebar();
  if (!user) return null;
  const shortcuts = shortcutsFor(navItemsFor(user));
  const onShortcut = shortcuts.some((i) => isActivePath(i.url, location));

  return (
    <nav
      className="md:hidden fixed inset-x-3 z-30 rounded-2xl border bg-card/95 backdrop-blur shadow-lg"
      style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label="Main"
      data-testid="nav-mobile-bottom"
    >
      <div className="flex items-stretch gap-1 p-1.5">
        {shortcuts.map((item) => {
          const active = isActivePath(item.url, location);
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`${itemClass} ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
              aria-current={active ? "page" : undefined}
              data-testid={`link-bottom-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="truncate max-w-full">{item.title === "Time Tracking" ? "Time" : item.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={`${itemClass} ${onShortcut ? "text-muted-foreground" : "bg-primary/10 text-primary"}`}
          data-testid="button-bottom-more"
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
