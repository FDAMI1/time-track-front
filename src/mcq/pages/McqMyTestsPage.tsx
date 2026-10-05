import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Clock, FileCheck, Play, CheckCircle2, Home } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqAssignment } from "@/mcq/lib/types";

export default function McqMyTestsPage() {
  const api = useMcqApi();
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["/api/mcq/student/assignments"],
    queryFn: () => api.get<McqAssignment[]>("/api/mcq/student/assignments"),
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div></div>;
  }

  const list = assignments || [];
  const pending = list.filter((a) => a.status !== "COMPLETED");
  const completed = list.filter((a) => a.status === "COMPLETED");

  const renderCard = (a: McqAssignment, showAction: boolean) => (
    <Card key={a._id}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate" data-testid={`text-test-name-${a._id}`}>{a.test?.title || "Unknown Test"}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.test?.duration} min</span>
              <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />{a.test?.maxAttempts} attempt(s)</span>
              <Badge variant="secondary" className="text-[10px]">{a.test?.status}</Badge>
              {a.allowHomeTest && <Badge variant="secondary" className="text-[10px]"><Home className="w-3 h-3 mr-1" />Home</Badge>}
            </div>
          </div>
          {showAction && a.test?.status === "ACTIVE" && (
            <Link href={`/take-test/${a.test._id}`}><Button size="sm" data-testid={`button-take-test-${a.test._id}`}><Play className="w-3 h-3 mr-1" />Take Test</Button></Link>
          )}
          {a.status === "COMPLETED" && <Badge variant="default" className="bg-chart-2/10 text-chart-2"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>}
        </div>
      </CardContent>
    </Card>
  );

  const empty = (icon: React.ReactNode, text: string) => (
    <Card><CardContent className="p-12 text-center"><div className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3">{icon}</div><p className="text-muted-foreground">{text}</p></CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Tests</h1>
        <p className="text-muted-foreground text-sm mt-1">{list.length} assigned tests</p>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length > 0 ? pending.map((a) => renderCard(a, true)) : empty(<ClipboardList className="w-12 h-12" />, "No pending tests")}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3 mt-4">
          {completed.length > 0 ? completed.map((a) => renderCard(a, false)) : empty(<CheckCircle2 className="w-12 h-12" />, "No completed tests yet")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
