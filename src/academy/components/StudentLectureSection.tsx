import { useQuery } from "@tanstack/react-query";
import { useMcqApi } from "@/mcq/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { LectureHistoryCard, RecoveryHistoryCard, TopicStatusList } from "@/academy/components/LectureHistory";
import type { StudentProgress } from "@/academy/lib/progress";

// Lecture History & Learning Progress on a student's details page, from the same Student Progress
// data (and access rules) the Progress page uses. Read only; changes are made on the Progress page.
export default function StudentLectureSection({ studentId }: { studentId: string }) {
  const api = useMcqApi();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/progress", `/api/progress/students/${studentId}`],
    queryFn: () => api.get<StudentProgress>(`/api/progress/students/${studentId}`),
  });
  return (
    <section className="space-y-4" data-testid="section-lecture-history">
      <h2 className="text-lg font-semibold">Lecture History & Learning Progress</h2>
      {isLoading && <Skeleton className="h-40 w-full" />}
      {error && <p className="text-sm text-muted-foreground">{(error as Error).message}</p>}
      {data && (
        <>
          <LectureHistoryCard attendance={data.attendance} />
          <TopicStatusList topics={data.topics} notStarted={data.courses.reduce((sum, c) => sum + c.notYetTaught, 0)} />
          <RecoveryHistoryCard attendance={data.attendance} />
        </>
      )}
    </section>
  );
}
