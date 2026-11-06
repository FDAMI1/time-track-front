import { jsPDF } from "jspdf";

export interface MemberProfile {
  member: {
    _id: string; firstName: string; lastName: string; username: string; email?: string; phone?: string; role: string;
    userId?: string; photoUrl?: string; isActive: boolean; createdAt: string; organizationId?: { name: string; type: string };
  };
  period: { from: string; to: string };
  sections: {
    timeTracking?: {
      approvedMinutes: number;
      manual: { total: number; approved: number; pending: number; rejected: number; pendingMinutes: number };
      daily: { date: string; minutes: number }[];
      entries: { _id: string; date: string; taskName: string; startTime: string; endTime: string; duration: number; source?: string; status?: string }[];
    };
    sessions?: { count: number; totalMinutes: number; sessions: { loginAt: string; logoutAt: string | null; lastSeenAt: string; minutes: number; signedOut: boolean }[] };
    attendance?: { total: number; present?: number; late?: number; absent?: number; pending?: number; records: { date: string; status: string; checkInTime?: string; checkOutTime?: string }[] };
    leads?: {
      assigned: number; new: number; hot: number; converted: number; pendingFollowUps: number; completedFollowUps: number;
      calls: number; notes: number; discussions: number; whatsapp: number; transferredOut: number; transferredIn: number; currentlyOwned: number;
    };
    tickets?: { raised: number; currentlyAssigned: number; pending: number; resolved: number; replies: number; internalNotes: number; attachments: number; transfersMade: number; tickets: { _id: string; ticketKey: string; subject: string; status: string }[] };
    progress?: { courses: { batchId: string; course: string; batchName: string; progress: number; completed: number; totalPortion: number; pending: number }[]; pending: { _id: string; topicTitle: string; originalDate: string }[] };
    mcq?: { assigned: number; completed: number; attempted: number; pending: number; missed: number; tests: { testId: string; title: string; state: string; score?: number; totalMarks?: number; percentage?: number; lastAttemptAt?: string | null }[] };
  };
}

export const hoursOf = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

// A printable summary of the same numbers the page shows.
export function profilePdf(p: MemberProfile) {
  const doc = new jsPDF();
  let y = 16;
  const line = (text: string, size = 10, bold = false) => {
    if (y > 280) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, 14, y);
    y += size * 0.5 + 2.5;
  };
  const m = p.member;
  const s = p.sections;
  line(`${m.firstName} ${m.lastName}`, 16, true);
  line(`${m.role} · @${m.username}${m.userId ? ` · ID ${m.userId}` : ""}${m.email ? ` · ${m.email}` : ""}`, 9);
  line(`Period: ${p.period.from || "start"} to ${p.period.to || "today"}`, 9);
  y += 3;
  if (s.timeTracking) {
    line("Time tracking", 12, true);
    line(`Approved working time: ${hoursOf(s.timeTracking.approvedMinutes)}`);
    line(`Manual entries: ${s.timeTracking.manual.approved} approved, ${s.timeTracking.manual.pending} pending, ${s.timeTracking.manual.rejected} rejected`);
  }
  if (s.sessions) line(`Sessions: ${s.sessions.count}, total ${hoursOf(s.sessions.totalMinutes)}`);
  if (s.attendance) { y += 2; line("Attendance", 12, true); line(`Present ${s.attendance.present || 0} · Late ${s.attendance.late || 0} · Absent ${s.attendance.absent || 0} · Records ${s.attendance.total}`); }
  if (s.leads) {
    y += 2; line("CRM leads", 12, true);
    line(`Assigned ${s.leads.assigned} · New ${s.leads.new} · Hot ${s.leads.hot} · Converted ${s.leads.converted} · Owned now ${s.leads.currentlyOwned}`);
    line(`Follow-ups pending ${s.leads.pendingFollowUps} · completed ${s.leads.completedFollowUps} · Calls ${s.leads.calls} · Notes ${s.leads.notes} · Transfers out ${s.leads.transferredOut} / in ${s.leads.transferredIn}`);
  }
  if (s.tickets) {
    y += 2; line("Tickets", 12, true);
    line(`Raised ${s.tickets.raised} · Assigned now ${s.tickets.currentlyAssigned} · Pending ${s.tickets.pending} · Resolved ${s.tickets.resolved}`);
    line(`Replies ${s.tickets.replies} · Internal notes ${s.tickets.internalNotes} · Attachments ${s.tickets.attachments} · Transfers ${s.tickets.transfersMade}`);
  }
  if (s.progress) { y += 2; line("Student progress", 12, true); s.progress.courses.forEach((c) => line(`${c.course} (${c.batchName}): ${c.progress}% — ${c.completed}/${c.totalPortion} topics, ${c.pending} pending`)); }
  if (s.mcq) { y += 2; line("MCQ", 12, true); line(`Assigned ${s.mcq.assigned} · Completed ${s.mcq.completed} · Pending ${s.mcq.pending} · Missed ${s.mcq.missed}`); s.mcq.tests.forEach((t) => line(`${t.title}: ${t.state}${t.totalMarks ? ` — ${t.score}/${t.totalMarks} (${t.percentage}%)` : ""}`, 9)); }
  doc.save(`profile-${m.username}.pdf`);
}
