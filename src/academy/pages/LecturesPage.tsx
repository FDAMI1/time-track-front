import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { addDays, dayLabel, localToday, mondayOf, nameOf, weekOf, type Lecture } from "@/academy/lib/academy";
import { ListState, StatusBadge } from "@/academy/components/common";
import LectureDialog from "@/academy/components/LectureDialog";
import LectureAttendanceDialog from "@/academy/components/LectureAttendanceDialog";

const isLink = (room: string) => /^https?:\/\//i.test(room);

export default function LecturesPage() {
  const api = useMcqApi();
  const { user } = useAuth();
  const today = localToday();
  const [monday, setMonday] = useState(mondayOf(today));
  // null is closed, "new" is the create form, otherwise the lecture being edited.
  const [editing, setEditing] = useState<Lecture | "new" | null>(null);
  const [marking, setMarking] = useState<Lecture | null>(null);
  const canManage = user?.role !== "student";
  const days = weekOf(monday);
  const url = `/api/lectures?from=${days[0]}&to=${days[6]}`;

  const { data, isLoading, error } = useQuery({ queryKey: ["/api/lectures", days[0]], queryFn: () => api.get<Lecture[]>(url) });
  const lectures = data || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lectures</h1>
          <p className="text-muted-foreground text-sm mt-1">{dayLabel(days[0])} to {dayLabel(days[6])}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week" data-testid="button-previous-week"><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => setMonday(mondayOf(today))} data-testid="button-this-week">This Week</Button>
          <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week" data-testid="button-next-week"><ChevronRight className="w-4 h-4" /></Button>
          {canManage && <Button onClick={() => setEditing("new")} data-testid="button-new-lecture"><Plus className="w-4 h-4 mr-2" />New Lecture</Button>}
        </div>
      </div>

      <ListState isLoading={isLoading} error={error} isEmpty={lectures.length === 0} emptyText="No lectures this week" icon={CalendarDays}>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const items = lectures.filter((l) => l.date === day);
            // On a phone, empty days are left out so the list stays short.
            return (
              <div key={day} className={`space-y-2 min-w-0 ${items.length ? "" : "hidden lg:block"}`} data-testid={`day-${day}`}>
                <p className={`text-xs font-semibold ${day === today ? "text-primary" : "text-muted-foreground"}`}>{dayLabel(day)}</p>
                {items.map((lecture) => (
                  <Card key={lecture._id} data-testid={`card-lecture-${lecture._id}`}>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs font-mono text-muted-foreground">{lecture.startTime} to {lecture.endTime}</p>
                      {canManage ? (
                        <button type="button" className="font-medium text-sm text-left hover:underline break-words" onClick={() => setEditing(lecture)} data-testid={`button-edit-lecture-${lecture._id}`}>{lecture.title}</button>
                      ) : (
                        <p className="font-medium text-sm break-words">{lecture.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground break-words">{lecture.batchId?.batchName} · {nameOf(lecture.teacherId)}</p>
                      {lecture.room && (isLink(lecture.room)
                        ? <a className="text-xs text-primary underline break-all" href={lecture.room} target="_blank" rel="noreferrer">Join link</a>
                        : <p className="text-xs text-muted-foreground break-words">{lecture.room}</p>)}
                      {(lecture.subject || lecture.portion) && <p className="text-xs break-words">{[lecture.subject, lecture.portion].filter(Boolean).join(" · ")}</p>}
                      {lecture.status !== "scheduled" && <StatusBadge status={lecture.status} />}
                      {canManage && lecture.status !== "cancelled" && lecture.date <= today && (
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs w-full mt-1" onClick={() => setMarking(lecture)} data-testid={`button-attendance-${lecture._id}`}>
                          {lecture.status === "completed" ? "Attendance" : "Mark Attendance"}
                        </Button>
                      )}
                      {!canManage && lecture.notes && <p className="text-xs break-words">{lecture.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      </ListState>

      {marking && <LectureAttendanceDialog lecture={marking} onClose={() => setMarking(null)} />}
      {editing && <LectureDialog lecture={editing === "new" ? null : editing} defaultDate={days.includes(today) ? today : days[0]} onClose={() => setEditing(null)} />}
    </div>
  );
}
