import { useAuth } from "@/lib/auth";

const greetingFor = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

// Phones only: the dashboard opens with a greeting card in the app's primary colour.
export function MobileGreeting() {
  const { user } = useAuth();
  if (!user) return null;
  const now = new Date();
  const org = user.organizationId?.name;
  return (
    <section
      className="md:hidden mx-6 mt-5 -mb-1 rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-md"
      data-testid="card-mobile-greeting"
    >
      <p className="text-sm opacity-90">{greetingFor(now.getHours())},</p>
      <p className="text-2xl font-bold leading-tight">{user.firstName}</p>
      <p className="mt-2 text-xs opacity-90">
        {[org, now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })].filter(Boolean).join(" · ")}
      </p>
    </section>
  );
}
