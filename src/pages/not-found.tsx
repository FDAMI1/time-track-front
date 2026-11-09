import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// Shown for an unknown address, and for a page this person's permissions don't include.
export default function NotFound() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-6">
      <div className="max-w-md space-y-3" role="alert">
        <h1 className="page-title">Page not available</h1>
        <p className="text-muted-foreground">
          This page doesn't exist, or your account doesn't include it. If you need it, ask your admin to switch it on for you.
        </p>
        <Button asChild><Link href="/">Go to Dashboard</Link></Button>
      </div>
    </div>
  );
}
