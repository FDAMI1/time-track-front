import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { capitalize, type RequesterInfo, type Ticket } from "@/tickets/lib/types";

// Contact details reach agents only; `requester` is absent for everyone else.
export default function RequesterCard({ ticket, requester }: { ticket: Ticket; requester?: RequesterInfo | null }) {
  const rows = [
    ["Email", requester?.email],
    ["Phone", requester?.phone],
    ["Role", requester?.role ? capitalize(requester.role.replace("_", " ")) : ""],
    ["Department", requester?.departmentId?.departmentName || ticket.departmentId?.departmentName],
  ].filter(([, value]) => value);

  return (
    <Card data-testid="card-requester">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Requester information</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium break-words">{ticket.requesterName}</p>
        {rows.map(([label, value]) => <p key={label} className="break-words"><span className="text-muted-foreground">{label}: </span>{value}</p>)}
      </CardContent>
    </Card>
  );
}
