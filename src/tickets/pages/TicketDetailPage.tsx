import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTicketMeta } from "@/tickets/lib/useTicketMeta";
import { useTicketDetail } from "@/tickets/lib/useTicketDetail";
import { capitalize, PRIORITY_CLASSES, sourceLabel } from "@/tickets/lib/types";
import DetailsTab from "@/tickets/components/detail/DetailsTab";
import RelatedTab from "@/tickets/components/detail/RelatedTab";
import TasksTab from "@/tickets/components/detail/TasksTab";
import ActivityTab from "@/tickets/components/detail/ActivityTab";
import ResolutionTab from "@/tickets/components/detail/ResolutionTab";
import StatusCard from "@/tickets/components/detail/StatusCard";
import RequesterCard from "@/tickets/components/detail/RequesterCard";
import PropertiesCard from "@/tickets/components/detail/PropertiesCard";
import PeopleCard from "@/tickets/components/detail/PeopleCard";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: meta } = useTicketMeta();
  const controls = useTicketDetail(id);
  const { data, isLoading, error, action } = controls;

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <p>This ticket doesn't exist or you don't have access to it.</p>
        <Link href="/" className="text-primary underline text-sm">Back to tickets</Link>
      </CardContent></Card>
    );
  }

  const { ticket, permissions } = data;
  const manage = permissions.manage;
  const statusLabel = (key: string) => meta?.statuses.find((s) => s.key === key)?.label || key;
  const watch = () => (permissions.watching
    ? action.mutate({ path: `watchers/${user?._id}`, method: "delete" })
    : action.mutate({ path: "watchers" }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Tickets</Link>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span className="text-sm font-mono text-muted-foreground" data-testid="text-ticket-key">{ticket.ticketKey}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[ticket.priority]}`}>{capitalize(ticket.priority)}</span>
          <Badge variant="secondary" data-testid="badge-ticket-status">{statusLabel(ticket.status)}</Badge>
          {ticket.isArchived && <Badge variant="outline">Archived</Badge>}
        </div>
        <h1 className="page-title mt-1 break-words">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1">Raised by {ticket.requesterName} on {new Date(ticket.createdAt).toLocaleString()} via {sourceLabel(ticket.source)}</p>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {user?.role !== "superadmin" && (
            <Button variant="outline" size="sm" onClick={watch} data-testid="button-watch">
              {permissions.watching ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}{permissions.watching ? "Stop watching" : "Watch"}
            </Button>
          )}
          {manage && !!meta?.scenarios.length && (
            <div className="w-48">
              <Select value="" onValueChange={(scenarioId) => action.mutate({ path: `scenarios/${scenarioId}` })}>
                <SelectTrigger className="h-9" aria-label="Run a scenario" data-testid="select-scenario"><SelectValue placeholder="Run a scenario" /></SelectTrigger>
                <SelectContent>{meta.scenarios.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <Tabs defaultValue="details">
            <TabsList className="flex-wrap h-auto" aria-label="Ticket sections">
              <TabsTrigger value="details" data-testid="tab-ticket-details">Details</TabsTrigger>
              <TabsTrigger value="related" data-testid="tab-ticket-related">Related tickets</TabsTrigger>
              {manage && <TabsTrigger value="tasks" data-testid="tab-ticket-tasks">Tasks</TabsTrigger>}
              <TabsTrigger value="activity" data-testid="tab-ticket-activity">Activity</TabsTrigger>
              <TabsTrigger value="resolution" data-testid="tab-ticket-resolution">Resolution</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4"><DetailsTab controls={controls} meta={meta} /></TabsContent>
            <TabsContent value="related" className="mt-4"><RelatedTab controls={controls} /></TabsContent>
            {manage && <TabsContent value="tasks" className="mt-4"><TasksTab controls={controls} meta={meta} /></TabsContent>}
            <TabsContent value="activity" className="mt-4"><ActivityTab events={data.events} statusLabel={statusLabel} /></TabsContent>
            <TabsContent value="resolution" className="mt-4"><ResolutionTab controls={controls} /></TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 min-w-0">
          <StatusCard ticket={ticket} />
          <RequesterCard ticket={ticket} requester={data.requester} />
          <PropertiesCard controls={controls} meta={meta} />
          {manage && <PeopleCard controls={controls} />}
        </div>
      </div>
    </div>
  );
}
