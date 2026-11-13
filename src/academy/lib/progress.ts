import { jsPDF } from "jspdf";

export interface ProgressCourse {
  batchId: string; batchName: string; course: string; status: string;
  totalPortion: number; completed: number; pending: number; notYetTaught: number; progress: number;
  recoveryRequired?: number; lecturesAssigned?: number;
  lecturesAttended: number; lecturesMissed: number; makeups: number;
}
export interface ProgressTopic {
  _id: string; batchId: string; subject: string; topicTitle: string; originalDate: string; originalLectureId?: string;
  lecturerId?: { firstName: string; lastName: string } | null;
  status: "pending" | "completed"; completedDate: string; completedVia: "" | "lecture" | "makeup" | "manual";
  // Pending because the student was absent or their check-in was denied: needs a recovery lecture.
  recoveryRequired?: boolean;
  history?: { action: string; note?: string; byName?: string; at: string }[];
}
type Who = { firstName: string; lastName: string };
export interface ProgressAttendance {
  _id: string; batchId: string; kind: "regular" | "makeup"; status: "present" | "absent" | "rejected"; date: string; notes?: string;
  method?: "" | "checkin" | "manual"; markedBy?: Who | null; startTime?: string; durationMinutes?: number; topicTaught?: string;
  lectureId?: {
    _id?: string; title: string; subject?: string; portion?: string; date: string; startTime?: string; endTime?: string;
    actualStartTime?: string; actualEndTime?: string; durationMinutes?: number; teacherId?: Who | null;
  } | null;
}
// A topic a student missed and hasn't recovered yet, for the recovery list.
export interface RecoveryTopic {
  _id: string; topicTitle: string; subject: string; originalDate: string; status: "pending";
  attendanceStatus: "absent" | "rejected";
  studentId: { _id: string; firstName: string; lastName: string; username: string; userId?: string; photoUrl?: string } | null;
  lecturerId?: Who | null;
  originalLectureId: { _id: string; title: string; subject?: string; portion?: string; date: string; batchId?: { batchName: string } | null } | null;
}

// Display status of a topic for one student.
export const topicState = (t: ProgressTopic) => (t.status === "completed" ? "Completed" : t.recoveryRequired ? "Recovery Required" : "Pending");
export const ATTENDANCE_LABEL: Record<string, string> = { present: "Present", absent: "Absent", rejected: "Rejected" };
export interface StudentProgress {
  student: { _id: string; firstName: string; lastName: string; username: string; email?: string; userId?: string; phone?: string; photoUrl?: string; createdAt?: string };
  courses: ProgressCourse[];
  topics: ProgressTopic[];
  attendance: ProgressAttendance[];
  dailyAttendance: Record<string, number>;
  fees: { billed: number; paid: number; balance: number };
  mcq?: {
    assigned: number; completed: number; attempted: number; pending: number; missed: number;
    tests: { testId: string; title: string; state: string; attempts: number; lastAttemptAt?: string | null; score?: number; totalMarks?: number; percentage?: number; result?: string; endDate?: string | null }[];
  };
}

export const VIA: Record<string, string> = { lecture: "Lecture", makeup: "Make-up lecture", manual: "Teacher, by hand" };
export const person = (p?: { firstName?: string; lastName?: string } | null) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "");

// A printable progress sheet built in the browser from the same data the page shows,
// which the server has already limited to what this person may see.
export function progressPdf(data: StudentProgress, period: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const width = doc.internal.pageSize.getWidth();
  const bottom = doc.internal.pageSize.getHeight() - 12;
  let y = 14;
  const line = (text: string, size = 10, bold = false) => {
    if (y > bottom) { doc.addPage(); y = 14; }
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 12, y);
    y += size * 0.5 + 2;
  };
  const table = (head: string[], rows: string[][], widths: number[]) => {
    const draw = (cells: string[], bold: boolean) => {
      if (y > bottom) { doc.addPage(); y = 14; }
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8.5);
      let x = 12;
      cells.forEach((c, i) => { doc.text(doc.splitTextToSize(String(c ?? ""), widths[i] - 2)[0] || "", x, y); x += widths[i]; });
      y += 5.5;
    };
    draw(head, true);
    doc.line(12, y - 4, width - 12, y - 4);
    rows.forEach((r) => draw(r, false));
    y += 3;
  };

  const s = data.student;
  line(`Student progress — ${person(s)}`, 15, true);
  line(`Student ID: ${s.userId || "—"}   ·   Username: ${s.username}   ·   Period: ${period}`, 9);
  y += 2;
  line("Courses", 11, true);
  table(["Course", "Batch", "Total", "Completed", "Pending", "Not yet taught", "Progress", "Attended", "Missed", "Make-ups"],
    data.courses.map((c) => [c.course, c.batchName, String(c.totalPortion), String(c.completed), String(c.pending), String(c.notYetTaught), `${c.progress}%`, String(c.lecturesAttended), String(c.lecturesMissed), String(c.makeups)]),
    [45, 45, 18, 22, 20, 28, 22, 22, 20, 22]);
  line("Topics", 11, true);
  table(["Subject", "Topic", "Lecture date", "Lecturer", "Status", "Completed on", "How"],
    data.topics.map((t) => [t.subject, t.topicTitle, t.originalDate, person(t.lecturerId), topicState(t), t.completedDate || "Not completed", VIA[t.completedVia] || ""]),
    [35, 70, 28, 40, 25, 30, 35]);
  doc.save(`progress-${person(s).replace(/\s+/g, "-") || s.username}.pdf`);
}
