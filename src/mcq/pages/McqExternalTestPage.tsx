import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, Trophy, ShieldAlert, Download, AlertTriangle } from "lucide-react";
import { createMcqApi } from "@/mcq/lib/api";
import { scoreVariant, VIOLATION_LABELS, type TakeTestQuestion, type ViolationType, type WarningResponse } from "@/mcq/lib/types";
import ProctorCamera from "@/mcq/components/ProctorCamera";

// Public, no-login test page reached via a test's share link. Renders outside
// the authenticated app shell.
const api = createMcqApi(null);

interface PreInfo { title: string; description: string; duration: number; questionCount: number; proctorWarningLimit: number }
interface StartData { test: { title: string; duration: number }; questions: TakeTestQuestion[]; timeRemaining: number; proctorWarningLimit: number; warningCount: number; studentName: string }
interface ResultData { studentName: string; testTitle: string; submittedAt: string; score: number; totalMarks: number; avgPercentage: number; warningCount: number }

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function McqExternalTestPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { toast } = useToast();
  const base = `/api/mcq/public/test/${shareToken}`;

  const [preInfo, setPreInfo] = useState<PreInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [testInfo, setTestInfo] = useState<{ title: string; duration: number } | null>(null);
  const [questions, setQuestions] = useState<TakeTestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [terminated, setTerminated] = useState(false);
  const [warningLimit, setWarningLimit] = useState(5);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenShareError, setScreenShareError] = useState(false);
  const studentIdRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScreenStream(null);
  }, []);

  useEffect(() => {
    api.get<PreInfo>(`${base}/info`).then(setPreInfo).catch(() => setPreInfo(null)).finally(() => setLoadingInfo(false));
  }, [base]);

  useEffect(() => () => stopScreenShare(), [stopScreenShare]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const data = await api.post<ResultData>(`${base}/submit`, {
        studentId: studentIdRef.current,
        answers: questions.map((q) => ({ questionId: q._id, selectedAnswer: answers[q._id] ?? null })),
      });
      setSubmitted(true);
      setResult(data);
      stopScreenShare();
    } catch (err) {
      toast({ title: "Submit failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [questions, answers, base, submitted, submitting, stopScreenShare, toast]);

  useEffect(() => {
    if (!started || submitted || terminated || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => { if (t <= 1) { handleSubmit(); return 0; } return t - 1; }), 1000);
    return () => clearInterval(timer);
  }, [started, submitted, terminated, timeLeft, handleSubmit]);

  const handleWarning = useCallback(async (violationType: ViolationType) => {
    if (!started || submitted || terminated) return;
    try {
      const res = await api.post<WarningResponse>(`${base}/warning`, { studentId: studentIdRef.current, violationType });
      setWarningCount(res.warningCount);
      if (res.terminated) { setTerminated(true); setSubmitted(true); stopScreenShare(); return; }
      toast({ title: `Warning ${res.warningCount}/${res.warningLimit}`, description: `${VIOLATION_LABELS[violationType] || violationType}. ${res.remaining} warning(s) remaining.`, variant: "destructive" });
    } catch {
      /* non-fatal */
    }
  }, [started, submitted, terminated, base, stopScreenShare, toast]);

  useEffect(() => {
    if (!started || submitted || terminated) return;
    const onCopy = (e: Event) => { e.preventDefault(); handleWarning("copy_attempt"); };
    const onKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); handleWarning("copy_attempt"); } };
    const onSelect = (e: Event) => e.preventDefault();
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onCopy);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("selectstart", onSelect);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onCopy);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("selectstart", onSelect);
    };
  }, [started, submitted, terminated, handleWarning]);

  const handleStart = async () => {
    const sid = studentId.trim().toUpperCase();
    if (!sid) return toast({ title: "Student ID required", description: "Please enter your Student ID to start the test.", variant: "destructive" });
    setLoading(true);
    try {
      const data = await api.post<StartData>(`${base}/start`, { studentId: sid });
      studentIdRef.current = sid;
      setTestInfo(data.test);
      setQuestions(data.questions);
      setTimeLeft(data.timeRemaining);
      setWarningLimit(data.proctorWarningLimit);
      setWarningCount(data.warningCount || 0);
      setStudentName(data.studentName);
    } catch (err) {
      toast({ title: "Cannot start test", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const consentAndStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: false });
      streamRef.current = stream;
      setScreenStream(stream);
      setScreenShareError(false);
      setStarted(true);
    } catch {
      setScreenShareError(true);
      toast({ title: "Screen sharing required", description: "You must share your screen to proceed with this test.", variant: "destructive" });
    }
  };

  const downloadExcel = () => {
    if (!result) return;
    const ws = XLSX.utils.json_to_sheet([{
      "Student Name": result.studentName,
      "Assigned Test": result.testTitle,
      "Submitted At": new Date(result.submittedAt).toLocaleString(),
      Score: `${result.score}/${result.totalMarks}`,
      "Average Percentage": `${result.avgPercentage}%`,
    }]);
    ws["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Result");
    XLSX.writeFile(wb, `${result.studentName}_${result.testTitle}_Result.xlsx`);
  };

  const screen = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-background p-4"><Card className="max-w-lg w-full"><CardContent className="p-8 text-center space-y-6">{children}</CardContent></Card></div>
  );

  if (loadingInfo) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!preInfo) {
    return screen(<><AlertCircle className="w-12 h-12 text-destructive mx-auto" /><h2 className="text-xl font-bold text-foreground">Test Not Found</h2><p className="text-muted-foreground text-sm">This test link is invalid or the test is no longer available.</p></>);
  }

  if (terminated) {
    return screen(
      <>
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-destructive/10"><ShieldAlert className="w-10 h-10 text-destructive" /></div>
        <div><h2 className="text-2xl font-bold text-foreground" data-testid="text-terminated-title">Test Terminated</h2><p className="text-muted-foreground text-sm mt-2">Your test was automatically terminated because you exceeded the maximum number of proctoring warnings ({warningLimit}).</p></div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4 text-left space-y-1"><p className="text-sm font-medium text-foreground">Violations Recorded:</p><p className="text-sm text-muted-foreground">{warningCount} warning(s) out of {warningLimit} allowed</p><p className="text-xs text-muted-foreground">This test has been marked as failed with a score of 0.</p></div>
      </>
    );
  }

  if (submitted && result) {
    const pct = result.avgPercentage;
    return screen(
      <>
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${pct >= 70 ? "bg-green-100" : pct >= 40 ? "bg-yellow-100" : "bg-red-100"}`}><Trophy className={`w-10 h-10 ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`} /></div>
        <div><h2 className="text-2xl font-bold text-foreground" data-testid="text-result-title">Test Completed!</h2><p className="text-muted-foreground text-sm mt-1">{result.testTitle}</p></div>
        <div className="py-2"><p className="text-5xl font-bold text-foreground" data-testid="text-result-score">{result.score}</p><p className="text-muted-foreground text-sm mt-1">out of {result.totalMarks} marks</p></div>
        <div className="h-3 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></div>
        <Badge variant={scoreVariant(pct)} className="text-lg px-4 py-1">{pct}%</Badge>
        <div className="space-y-3 pt-2">
          <Button className="w-full" onClick={downloadExcel} data-testid="button-download-result"><Download className="w-4 h-4 mr-2" />Download Result (Excel)</Button>
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><p className="text-xs text-amber-700 dark:text-amber-300 text-left">This result will not be available again. Please download it now.</p></div>
        </div>
      </>
    );
  }

  if (testInfo && !started) {
    return screen(
      <>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 mx-auto flex items-center justify-center"><ShieldAlert className="w-8 h-8 text-amber-500" /></div>
        <div><h2 className="text-xl font-bold text-foreground">Camera & Screen Monitoring Required</h2><p className="text-muted-foreground text-sm mt-2">Welcome, <strong>{studentName}</strong>. Your camera and screen will be monitored during this test.</p></div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4 text-left space-y-2">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Proctoring Rules:</p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc pl-4">
            <li>Only one person must be visible in the camera</li>
            <li>If no face or multiple faces are detected, a warning is issued</li>
            <li>Your screen will be shared for monitoring</li>
            <li>Maximum {warningLimit} warnings allowed; exceeding the limit fails the test</li>
            <li>Copying, right-clicking, and tab switching are not allowed</li>
          </ul>
        </div>
        {screenShareError && <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-left"><p className="text-sm text-destructive font-medium">Screen sharing was denied or cancelled.</p><p className="text-xs text-destructive/80 mt-1">You must share your screen to start this test.</p></div>}
        <Button className="w-full" onClick={consentAndStart} data-testid="button-consent-camera">{screenShareError ? "Try Again — Enable Camera & Screen Share" : "Enable Camera & Screen Share, Start Test"}</Button>
      </>
    );
  }

  if (!started) {
    return screen(
      <>
        <div className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center"><AlertCircle className="w-8 h-8 text-primary" /></div>
        <div><h2 className="text-xl font-bold text-foreground" data-testid="text-test-title">{preInfo.title}</h2><p className="text-muted-foreground text-sm mt-2">{preInfo.description || "Enter your Student ID to begin"}</p></div>
        <div className="bg-muted/50 rounded-md p-4 text-left space-y-2 text-sm">
          <p><strong>Duration:</strong> {preInfo.duration} minutes</p>
          <p><strong>Questions:</strong> {preInfo.questionCount}</p>
          <p><strong>Warning Limit:</strong> {preInfo.proctorWarningLimit} warnings</p>
        </div>
        <div className="space-y-3">
          <div className="text-left">
            <Label htmlFor="student-id" className="text-sm font-medium">Student ID</Label>
            <Input id="student-id" placeholder="Enter your Student ID (e.g., ALI2847)" value={studentId} onChange={(e) => setStudentId(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && handleStart()} className="mt-1" data-testid="input-student-id" />
          </div>
          <Button className="w-full" onClick={handleStart} disabled={loading} data-testid="button-start-test">{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Start Test"}</Button>
        </div>
      </>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-lg font-bold text-foreground">{testInfo?.title}</h1><p className="text-xs text-muted-foreground">Student: {studentName}</p></div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm ${timeLeft <= 60 ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}><Clock className="w-4 h-4" /><span data-testid="text-timer">{formatTime(timeLeft)}</span></div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {questions.map((q, i) => (
            <button key={q._id} type="button" onClick={() => setCurrentIndex(i)} aria-label={`Go to question ${i + 1}`} className={`w-8 h-8 rounded text-xs font-medium transition-colors ${i === currentIndex ? "bg-primary text-primary-foreground" : answers[q._id] !== undefined ? "bg-chart-2/20 text-chart-2 border border-chart-2/40" : "bg-muted text-muted-foreground hover:bg-accent"}`} data-testid={`button-question-${i}`}>{i + 1}</button>
          ))}
        </div>
        {question && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center justify-between"><span>Question {currentIndex + 1} of {questions.length}</span><Badge variant="secondary">{question.marks} mark{question.marks !== 1 ? "s" : ""}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground whitespace-pre-wrap" data-testid="text-question">{question.questionText}</p>
              <RadioGroup value={answers[question._id]?.toString() || ""} onValueChange={(v) => setAnswers((prev) => ({ ...prev, [question._id]: parseInt(v) }))}>
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={String(i)} id={`opt-${i}`} data-testid={`radio-option-${i}`} />
                    <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
              {question.negativeMarks > 0 && <p className="text-xs text-destructive">Negative marking: -{question.negativeMarks} for wrong answer</p>}
            </CardContent>
          </Card>
        )}
        <div className="flex items-center justify-between">
          {currentIndex > 0 ? <Button variant="outline" onClick={() => setCurrentIndex(currentIndex - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button> : <div />}
          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => setCurrentIndex(currentIndex + 1)} data-testid="button-next">Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} data-testid="button-submit-test">{submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <><Send className="w-4 h-4 mr-2" />Submit Test</>}</Button>
          )}
        </div>
      </div>
      {started && <ProctorCamera warningLimit={warningLimit} warningCount={warningCount} onWarning={(t) => handleWarning(t)} screenStream={screenStream} />}
    </div>
  );
}
