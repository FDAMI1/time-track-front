import { jsPDF } from "jspdf";

export interface ProgressCourse {
  batchId: string; batchName: string; course: string; status: string;
  totalPortion: number; completed: number; pending: number; notYetTaught: number; progress: number;
  lecturesAttended: number; lecturesMissed: number; makeups: number;
}
export interface ProgressTopic {
  _id: string; batchId: string; subject: string; topicTitle: string; originalDate: string;
  lecturerId?: { firstName: string; lastName: string } | null;
  status: "pending" | "completed"; completedDate: string; completedVia: "" | "lecture" | "makeup" | "manual";
  history?: { action: string; note?: string; byName?: string; at: string }[];
}
export interface ProgressAttendance {
  _id: string; batchId: string; kind: "regular" | "makeup"; status: "present" | "absent"; date: string; notes?: string;
  lectureId?: { title: string; subject?: string; portion?: string; date: string; teacherId?: { firstName: string; lastName: string } } | null;
}
export interface StudentProgress {
  student: { _id: string; firstName: string; lastName: string; username: string; email?: string; userId?: string; phone?: string; photoUrl?: string; createdAt?: string };
  courses: ProgressCourse[];
  topics: ProgressTopic[];
  attendance: ProgressAttendance[];
  dailyAttendance: Record<string, number>;
  fees: { billed: number; paid: number; balance: number };
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
    data.topics.map((t) => [t.subject, t.topicTitle, t.originalDate, person(t.lecturerId), t.status === "completed" ? "Completed" : "Pending", t.completedDate || "Not completed", VIA[t.completedVia] || ""]),
    [35, 70, 28, 40, 25, 30, 35]);
  doc.save(`progress-${person(s).replace(/\s+/g, "-") || s.username}.pdf`);
}
