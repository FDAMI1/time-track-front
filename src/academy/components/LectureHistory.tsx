import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime12 } from "@/lib/utils";
import { ATTENDANCE_LABEL, person, topicState, type ProgressAttendance, type ProgressTopic } from "@/academy/lib/progress";

const TONE: Record<string, string> = {
  Present: "text-green-700 dark:text-green-400", Completed: "text-green-700 dark:text-green-400",
  Absent: "text-destructive", Rejected: "text-destructive", "Recovery Required": "text-destructive", Pending: "text-amber-600",
};
const span = (start?: string, end?: string) => (start ? `${formatTime12(start)}${end ? ` – ${formatTime12(end)}` : ""}` : "");

// Every lecture the student was marked for: what was taught, when, by whom, and how attendance was decided.
// Original attendance only; recovery sessions are listed separately below.
export function LectureHistoryCard({ attendance }: { attendance: ProgressAttendance[] }) {
  const regular = attendance.filter((a) => a.kind === "regular");
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Lecture history</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {!regular.length ? <p className="text-sm text-muted-foreground">No lecture attendance in these dates.</p> : (
          <table className="w-full text-sm min-w-[760px]" data-testid="list-lecture-history">
            <thead><tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 pr-2">Lecture</th><th className="pr-2">Section</th><th className="pr-2">Date</th><th className="pr-2">Time</th><th className="pr-2">Duration</th><th className="pr-2">Teacher</th><th className="pr-2">Attendance</th><th>Method</th>
            </tr></thead>
            <tbody>
              {regular.map((a) => {
                const l = a.lectureId;
                const status = ATTENDANCE_LABEL[a.status] || a.status;
                return (
                  <tr key={a._id} className="border-b last:border-0 align-top" data-testid={`row-lecture-history-${a._id}`}>
                    <td className="py-2 pr-2">{l?.subject && <span className="text-xs text-muted-foreground block">{l.subject}</span>}{l?.title || "—"}</td>
                    <td className="pr-2">{l?.portion || "—"}</td>
                    <td className="pr-2 whitespace-nowrap">{a.date}</td>
                    <td className="pr-2 whitespace-nowrap">{span(l?.actualStartTime || l?.startTime, l?.actualEndTime || l?.endTime) || "—"}</td>
                    <td className="pr-2 whitespace-nowrap">{l?.durationMinutes ? `${l.durationMinutes} min` : "—"}</td>
                    <td className="pr-2">{person(l?.teacherId) || "—"}</td>
                    <td className="pr-2"><Badge variant="outline" className={TONE[status]}>{status}</Badge></td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">{a.method === "checkin" ? "Check-in decision" : a.method === "manual" ? "Marked by hand" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// Recovery sessions: the missed lecture, and when, by whom and for how long it was taught again.
export function RecoveryHistoryCard({ attendance }: { attendance: ProgressAttendance[] }) {
  const recoveries = attendance.filter((a) => a.kind === "makeup");
  if (!recoveries.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Recovery history</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y text-sm" data-testid="list-recovery-history">
          {recoveries.map((a) => (
            <li key={a._id} className="py-2 flex justify-between gap-2 flex-wrap">
              <span>
                <span className="font-medium">{a.lectureId?.title}</span>
                <span className="text-muted-foreground"> · missed {a.lectureId?.date}</span>
                <span className="block text-xs text-muted-foreground">
                  Recovered {a.date}{a.startTime ? ` at ${formatTime12(a.startTime)}` : ""}{a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
                  {a.markedBy ? ` · ${person(a.markedBy)}` : ""}{a.topicTaught ? ` · ${a.topicTaught}` : ""}
                </span>
              </span>
              <Badge variant="secondary">Completed</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Read-only topic statuses: Completed, Recovery Required or Pending; Not Started is the count of syllabus left.
export function TopicStatusList({ topics, notStarted }: { topics: ProgressTopic[]; notStarted: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Learning progress</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {!topics.length ? <p className="text-sm text-muted-foreground">No topics taught yet.</p> : (
          <ul className="divide-y text-sm" data-testid="list-topic-status">
            {topics.map((t) => (
              <li key={t._id} className="py-2 flex justify-between gap-2 flex-wrap">
                <span>{t.subject && <span className="text-xs text-muted-foreground block">{t.subject}</span>}{t.topicTitle} <span className="text-xs text-muted-foreground">· {t.originalDate}</span></span>
                <Badge variant="outline" className={TONE[topicState(t)]}>{topicState(t)}</Badge>
              </li>
            ))}
          </ul>
        )}
        {notStarted > 0 && <p className="text-xs text-muted-foreground">{notStarted} syllabus topic{notStarted === 1 ? "" : "s"} not started yet.</p>}
      </CardContent>
    </Card>
  );
}
