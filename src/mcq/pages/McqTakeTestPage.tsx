import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, Trophy, Camera, ShieldAlert } from "lucide-react";
import { dataUrlToBlob, useMcqApi } from "@/mcq/lib/api";
import { pctOf, scoreVariant, type McqAttemptDetail, type StartTestResponse, type TakeTestQuestion, type ViolationType, type WarningResponse } from "@/mcq/lib/types";
import ProctorCamera, { captureProctorScreenshot } from "@/mcq/components/ProctorCamera";

const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  no_face: "No face detected — make sure your face is clearly visible in the camera",
  multiple_faces: "Multiple people detected — only the test taker should be visible",
  tab_switch: "You switched away from the test tab — stay on this tab during the exam",
  camera_lost: "Camera connection lost — check your camera permissions",
  copy_attempt: "Copy attempt detected — copying question text is not allowed during the exam",
  fullscreen_exit: "You exited fullscreen mode — please stay in fullscreen during the exam",
  screen_share_stopped: "Screen sharing was stopped — your screen must remain shared during the exam",
};

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function McqTakeTestPage() {
  const { id } = useParams<{ id: string }>();
  const api = useMcqApi();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TakeTestQuestion[]>([]);
  const [testInfo, setTestInfo] = useState<{ title: string; duration: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<McqAttemptDetail | null>(null);
  const [isHomeTest, setIsHomeTest] = useState(false);
  const [warningLimit, setWarningLimit] = useState(5);
  const [warningCount, setWarningCount] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenShareError, setScreenShareError] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
  }, []);

  useEffect(() => () => stopScreenShare(), [stopScreenShare]);

  const start = useMutation({
    mutationFn: () => api.post<StartTestResponse>(`/api/mcq/student/tests/${id}/start`),
    onSuccess: (data) => {
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setTestInfo(data.test);
      setTimeLeft(data.timeRemaining ?? data.test.duration * 60);
      setIsHomeTest(data.isHomeTest);
      setWarningLimit(data.proctorWarningLimit || 5);
      setWarningCount(data.warningCount || 0);
      if (!data.isHomeTest) setStarted(true);
    },
    onError: (err: Error) => toast({ title: "Cannot start test", description: err.message, variant: "destructive" }),
  });

  const submit = useMutation({
    mutationFn: (payload: { questionId: string; selectedAnswer: number | null }[]) =>
      api.post<McqAttemptDetail>(`/api/mcq/student/attempts/${attemptId}/submit`, { answers: payload }),
    onSuccess: (data) => {
      setSubmitted(true);
      setResult(data);
      stopScreenShare();
      queryClient.invalidateQueries({ queryKey: ["/api/mcq/student/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mcq/student/attempts"] });
    },
    onError: (err: Error) => toast({ title: "Submit failed", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = useCallback(() => {
    if (submit.isPending || submitted) return;
    submit.mutate(questions.map((q) => ({ questionId: q._id, selectedAnswer: answers[q._id] ?? null })));
  }, [answers, questions, submit, submitted]);

  useEffect(() => {
    if (!started || submitted || terminated || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, submitted, terminated, timeLeft, handleSubmit]);

  const handleProctorWarning = useCallback(async (violationType: ViolationType, screenshot?: string) => {
    if (!attemptId || submitted || terminated) return;
    try {
      const form = new FormData();
      form.append("violationType", violationType);
      if (screenshot) form.append("screenshot", dataUrlToBlob(screenshot), "screenshot.png");
      const res = await api.post<WarningResponse>(`/api/mcq/student/attempts/${attemptId}/proctor-warning`, form);
      setWarningCount(res.warningCount);
      if (res.terminated) {
        setTerminated(true);
        setSubmitted(true);
        stopScreenShare();
        return;
      }
      toast({
        title: `⚠ Proctoring Warning ${res.warningCount}/${res.warningLimit}`,
        description: `${VIOLATION_MESSAGES[violationType]}. You have ${res.remaining} warning(s) remaining before automatic termination.`,
        variant: "destructive",
      });
    } catch {
      /* warning delivery failures are non-fatal for the taker */
    }
  }, [attemptId, submitted, terminated, api, toast, stopScreenShare]);

  useEffect(() => {
    if (!started || submitted || terminated || !isHomeTest) return;
    const onCopy = (e: Event) => { e.preventDefault(); handleProctorWarning("copy_attempt", captureProctorScreenshot()); };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); handleProctorWarning("copy_attempt", captureProctorScreenshot()); }
    };
    const onSelectStart = (e: Event) => e.preventDefault();
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onCopy);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("selectstart", onSelectStart);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onCopy);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("selectstart", onSelectStart);
    };
  }, [started, submitted, terminated, isHomeTest, handleProctorWarning]);

  const consentAndStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenShareError(false);
      setStarted(true);
    } catch {
      setScreenShareError(true);
      toast({ title: "Screen sharing required", description: "You must share your screen to proceed with this proctored test.", variant: "destructive" });
    }
  };

  const centered = (children: React.ReactNode) => <div className="max-w-lg mx-auto mt-8"><Card><CardContent className="p-8 text-center space-y-6">{children}</CardContent></Card></div>;

  if (terminated) {
    return centered(
      <>
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-destructive/10"><ShieldAlert className="w-10 h-10 text-destructive" /></div>
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-terminated-title">Test Terminated</h2>
          <p className="text-muted-foreground text-sm mt-2">Your test was automatically terminated because you exceeded the maximum number of proctoring warnings ({warningLimit}).</p>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4 text-left space-y-1">
          <p className="text-sm font-medium text-foreground">Violations Recorded:</p>
          <p className="text-sm text-muted-foreground">{warningCount} warning(s) out of {warningLimit} allowed</p>
          <p className="text-xs text-muted-foreground">This test has been marked as failed with a score of 0.</p>
        </div>
        <Button onClick={() => navigate("/my-tests")} data-testid="button-back-to-tests">Back to My Tests</Button>
      </>
    );
  }

  if (submitted && result) {
    const pct = pctOf(result.score, result.totalMarks);
    const tone = pct >= 70
      ? { ring: "bg-chart-2/10", text: "text-chart-2", bar: "bg-chart-2" }
      : pct >= 40
        ? { ring: "bg-chart-4/10", text: "text-chart-4", bar: "bg-chart-4" }
        : { ring: "bg-destructive/10", text: "text-destructive", bar: "bg-destructive" };
    return centered(
      <>
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${tone.ring}`}><Trophy className={`w-10 h-10 ${tone.text}`} /></div>
        <div><h2 className="text-2xl font-bold text-foreground" data-testid="text-result-title">Test Completed!</h2><p className="text-muted-foreground text-sm mt-1">{testInfo?.title}</p></div>
        <div className="py-2"><p className="text-5xl font-bold text-foreground" data-testid="text-result-score">{result.score}</p><p className="text-muted-foreground text-sm mt-1">out of {result.totalMarks} marks</p></div>
        <div className="h-3 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${tone.bar}`} style={{ width: `${pct}%` }} /></div>
        <Badge variant={scoreVariant(pct)} className="text-lg px-4 py-1">{pct}%</Badge>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="secondary" onClick={() => navigate(`/results/${result._id}`)}>View Details</Button>
          <Button onClick={() => navigate("/")}>Dashboard</Button>
        </div>
      </>
    );
  }

  if (isHomeTest && !started && attemptId) {
    return centered(
      <>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 mx-auto flex items-center justify-center"><Camera className="w-8 h-8 text-amber-500" /></div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Camera & Screen Monitoring Required</h2>
          <p className="text-muted-foreground text-sm mt-2">This is a home test. Your camera and screen will be monitored during the entire test for proctoring purposes.</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4 text-left space-y-2">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Proctoring Rules:</p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc pl-4">
            <li>Only one person must be visible in the camera</li>
            <li>If no face or multiple faces are detected, a warning is issued</li>
            <li>Your screen will be shared — a screenshot is captured on each warning</li>
            <li>Maximum {warningLimit} warnings allowed; exceeding the limit fails the test</li>
            <li>Copying, right-clicking, tab switching and stopping screen share trigger warnings</li>
          </ul>
        </div>
        {screenShareError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-left">
            <p className="text-sm text-destructive font-medium">Screen sharing was denied or cancelled.</p>
            <p className="text-xs text-destructive/80 mt-1">You must share your entire screen to start this test.</p>
          </div>
        )}
        <Button className="w-full" onClick={consentAndStart} data-testid="button-consent-camera"><Camera className="w-4 h-4 mr-2" />{screenShareError ? "Try Again — Enable Camera & Screen Share" : "Enable Camera & Screen Share, Start Test"}</Button>
        <Button variant="ghost" className="w-full" onClick={() => navigate("/my-tests")}>Cancel</Button>
      </>
    );
  }

  if (!started) {
    return centered(
      <>
        <div className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center"><AlertCircle className="w-8 h-8 text-primary" /></div>
        <div><h2 className="text-xl font-bold text-foreground">Ready to Start?</h2><p className="text-muted-foreground text-sm mt-2">Once you begin, the timer starts and you must complete the test within the given duration.</p></div>
        <Button className="w-full" onClick={() => start.mutate()} disabled={start.isPending} data-testid="button-start-exam">{start.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</> : "Begin Test"}</Button>
        <Button variant="ghost" className="w-full" onClick={() => navigate("/my-tests")} data-testid="button-go-back">Go Back</Button>
      </>
    );
  }

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-background z-10 py-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{testInfo?.title}</h2>
          <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {questions.length} | {answeredCount} answered</p>
        </div>
        <div className="flex items-center gap-2">
          {isHomeTest && <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600"><Camera className="w-3.5 h-3.5" /><span className="text-xs font-medium" data-testid="text-proctor-warnings">{warningCount}/{warningLimit}</span></div>}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm font-bold ${timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}><Clock className="w-4 h-4" /><span data-testid="text-timer">{formatTime(timeLeft)}</span></div>
        </div>
      </div>

      <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} className="h-1.5" />

      <div className="flex gap-2 flex-wrap">
        {questions.map((q, i) => (
          <button
            key={q._id}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${i === currentIndex ? "bg-primary text-primary-foreground" : answers[q._id] !== undefined ? "bg-chart-2/20 text-chart-2" : "bg-muted text-muted-foreground"}`}
            aria-label={`Go to question ${i + 1}`}
            data-testid={`button-question-nav-${i}`}
          >{i + 1}</button>
        ))}
      </div>

      {currentQ && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <Badge variant="secondary">{currentQ.marks} mark(s)</Badge>
              {currentQ.negativeMarks > 0 && <span className="text-xs text-destructive">-{currentQ.negativeMarks} for wrong answer</span>}
            </div>
            <p className="text-foreground font-medium text-lg mb-6 whitespace-pre-wrap" data-testid="text-current-question">{currentQ.questionText}</p>
            <RadioGroup value={answers[currentQ._id] !== undefined ? String(answers[currentQ._id]) : ""} onValueChange={(v) => setAnswers({ ...answers, [currentQ._id]: Number(v) })} className="space-y-3">
              {currentQ.options.map((opt, i) => (
                <label key={i} className={`flex items-center gap-3 p-3.5 rounded-md cursor-pointer border transition-colors ${answers[currentQ._id] === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <RadioGroupItem value={String(i)} id={`answer-${i}`} data-testid={`radio-answer-${i}`} />
                  <Label htmlFor={`answer-${i}`} className="cursor-pointer flex-1 text-sm text-foreground"><span className="font-medium text-muted-foreground mr-2">{String.fromCharCode(65 + i)}.</span>{opt}</Label>
                </label>
              ))}
            </RadioGroup>
            {answers[currentQ._id] !== undefined && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => { const next = { ...answers }; delete next[currentQ._id]; setAnswers(next); }} data-testid="button-clear-answer">Clear Answer</Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="secondary" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)} data-testid="button-prev-question"><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
        {!isLast ? (
          <Button onClick={() => setCurrentIndex(currentIndex + 1)} data-testid="button-next-question">Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submit.isPending} data-testid="button-submit-test">{submit.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <><Send className="w-4 h-4 mr-2" />Submit Test</>}</Button>
        )}
      </div>

      {isHomeTest && started && attemptId && (
        <ProctorCamera warningLimit={warningLimit} warningCount={warningCount} onWarning={handleProctorWarning} screenStream={screenStream} />
      )}
    </div>
  );
}
