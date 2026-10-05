export type PublishRule = "INSTANT" | "MANUAL" | "SCHEDULED";
export type TestStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED";
export type ProctorStatus = "CLEAN" | "WARNED" | "FLAGGED";
export type ViolationType =
  | "no_face"
  | "multiple_faces"
  | "tab_switch"
  | "camera_lost"
  | "copy_attempt"
  | "fullscreen_exit"
  | "screen_share_stopped";

export const VIOLATION_LABELS: Record<ViolationType, string> = {
  no_face: "No face detected",
  multiple_faces: "Multiple faces detected",
  tab_switch: "Tab switched",
  camera_lost: "Camera lost",
  copy_attempt: "Copy attempt",
  fullscreen_exit: "Fullscreen exit",
  screen_share_stopped: "Screen share stopped",
};

export interface McqQuestion {
  _id: string;
  subject: string;
  topic: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  negativeMarks: number;
  createdAt: string;
}

export interface QuestionPayload {
  subject: string;
  topic: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  negativeMarks: number;
}

export interface McqTest {
  _id: string;
  title: string;
  description: string;
  duration: number;
  maxAttempts: number;
  randomize: boolean;
  publishRule: PublishRule;
  status: TestStatus;
  proctorWarningLimit: number;
  shareToken: string | null;
  createdBy: string;
  creatorName?: string;
  questionCount?: number;
  assignedCount?: number;
  createdAt: string;
}

export interface McqTestQuestion {
  questionId: string;
  orderIndex: number;
  question: McqQuestion;
}

export interface McqTestDetail extends Omit<McqTest, "questionCount"> {
  questions: McqTestQuestion[];
}

export interface Paged<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

export interface McqAnswerSnapshot {
  questionId: string;
  questionText: string;
  options: string[];
  selectedAnswer: number | null;
  correctAnswer: number;
  marks: number;
  negativeMarks: number;
  marksAwarded: number;
  isCorrect: boolean;
}

export interface McqProctorLogEntry {
  type: ViolationType;
  message: string;
  timestamp: string;
  screenshotFileId?: string | null;
}

export interface McqAttemptSummary {
  _id: string;
  testId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number | null;
  proctorStatus?: ProctorStatus;
  proctorWarnings?: number;
  studentName?: string;
  studentEmail?: string;
  testTitle?: string | null;
  testDescription?: string | null;
  assignedBy?: string | null;
  student?: { _id: string; name: string; email: string } | null;
}

export interface McqAttemptDetail extends McqAttemptSummary {
  answers?: McqAnswerSnapshot[] | null;
  proctorLog?: McqProctorLogEntry[];
  isHomeTest?: boolean;
  test?: { _id: string; title: string; description?: string; proctorWarningLimit?: number };
}

export interface McqAssignment {
  _id: string;
  testId: string;
  studentId: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
  allowHomeTest: boolean;
  assignedAt: string;
  studentName?: string;
  studentEmail?: string;
  hasSubmitted?: boolean;
  test?: McqTest;
}

export interface McqShare {
  _id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  sharedByName: string;
  sharedAt: string;
}

export interface OrgUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export const userName = (u?: Partial<OrgUser> | null) =>
  `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || "Unknown";

export interface McqStudentPerformance {
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalAttempts: number;
  avgScore: number;
  totalScore: number;
  totalMarks: number;
  submitted: number;
  totalAssigned: number;
}

export interface McqTeacherPerformance {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  totalTests: number;
  totalAttempts: number;
  submittedAttempts: number;
  avgStudentScore: number;
  totalAssignments: number;
}

export interface McqStudentDetail {
  student: { id: string; name: string; email: string } | null;
  attempts: {
    attemptId: string;
    testId: string;
    testTitle?: string;
    testDescription?: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    totalMarks: number | null;
  }[];
}

export interface McqStats {
  totalTeachers: number;
  totalStudents: number;
  totalTests: number;
  totalAttempts: number;
  avgScore: number;
}

export interface McqExternalStudent {
  _id: string;
  name: string;
  studentId: string;
  phone: string;
  createdAt: string;
}

export interface McqExternalAttempt {
  _id: string;
  studentName: string;
  studentId: string;
  testTitle: string;
  score: number;
  totalMarks: number;
  avgPercentage: number;
  warningCount: number;
  status: "COMPLETED" | "TERMINATED";
  submittedAt: string;
}

export interface McqPdfTemplate {
  _id: string;
  name: string;
  createdAt: string;
  base64?: string;
}

export interface McqSettings {
  proctorWarningLimit: number;
  screenshotRetentionDays: number;
}

export interface TakeTestQuestion {
  _id: string;
  questionText: string;
  options: string[];
  marks: number;
  negativeMarks: number;
}

export interface StartTestResponse {
  attemptId: string;
  test: { _id: string; title: string; duration: number };
  questions: TakeTestQuestion[];
  isHomeTest: boolean;
  proctorWarningLimit: number;
  warningCount: number;
  timeRemaining: number;
}

export interface WarningResponse {
  warningCount: number;
  warningLimit: number;
  terminated: boolean;
  remaining?: number;
  message?: string;
}

export const pctOf = (score: number | null | undefined, total: number | null | undefined) =>
  total && total > 0 ? Math.round(((score || 0) / total) * 100) : 0;

export const scoreVariant = (pct: number): "default" | "secondary" | "destructive" =>
  pct >= 70 ? "default" : pct >= 40 ? "secondary" : "destructive";
