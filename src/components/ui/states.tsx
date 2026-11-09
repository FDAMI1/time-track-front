import type { ComponentType, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
}

// Nothing to show yet: say what would appear here and, when there is one, the next step.
export function EmptyState({ icon: Icon, title, description, action, testId }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4" data-testid={testId || "state-empty"}>
      {Icon && <Icon className="w-8 h-8 text-muted-foreground" aria-hidden />}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

// Loading failed: say what didn't load and offer to try again.
export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4" data-testid="state-error">
      <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden />
      <p className="font-medium">{what} couldn't be loaded</p>
      <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>}
    </div>
  );
}
