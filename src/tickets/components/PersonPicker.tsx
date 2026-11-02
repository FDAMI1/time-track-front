import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { personName, type NamedRef } from "@/tickets/lib/types";

interface Props {
  label: string;
  testId: string;
  value?: NamedRef | null;
  onChange: (person: NamedRef | null) => void;
}

interface Person extends NamedRef {
  username?: string;
}

// Search box for a member of the organization. Results come from the agents-only people route.
export default function PersonPicker({ label, testId, value, onChange }: Props) {
  const api = useMcqApi();
  const [text, setText] = useState("");
  const query = text.trim();
  const { data } = useQuery({
    queryKey: ["/api/tickets/people", query],
    queryFn: () => api.get<Person[]>(`/api/tickets/people?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm" data-testid={`${testId}-chosen`}>
        <span className="truncate">{personName(value) || "Selected"}</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Clear ${label}`} onClick={() => onChange(null)}><X className="w-3 h-3" /></Button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input placeholder={label} aria-label={label} value={text} onChange={(e) => setText(e.target.value)} data-testid={testId} />
      {query && !!data?.length && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {data.map((person) => (
            <li key={person._id}>
              <button
                type="button"
                className="w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => { onChange(person); setText(""); }}
                data-testid={`option-person-${person._id}`}
              >
                {personName(person) || person.username}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
