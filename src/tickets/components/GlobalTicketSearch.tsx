import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// The top bar's ticket search. Results open in the ticket list, under the usual access rules.
export default function GlobalTicketSearch() {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  return (
    <form
      className="relative hidden md:block w-64"
      role="search"
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) navigate(`/tickets?q=${encodeURIComponent(text.trim())}`); }}
    >
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9 h-9" placeholder="Search tickets" aria-label="Search tickets from anywhere" value={text} onChange={(e) => setText(e.target.value)} data-testid="input-global-ticket-search" />
    </form>
  );
}
