import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Upload, Loader2 } from "lucide-react";
import { parseBulkQuestions } from "@/mcq/lib/parseQuestions";
import type { McqQuestion, QuestionPayload } from "@/mcq/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: McqQuestion | null;
  // When provided, subject/topic are fixed (e.g. adding questions inside a test).
  lockedMeta?: { subject: string; topic: string };
  pending: boolean;
  onSave: (payload: QuestionPayload) => void;
  onBulkSave: (payloads: QuestionPayload[]) => void;
}

const emptyForm = (): QuestionPayload => ({
  subject: "",
  topic: "",
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  marks: 2,
  negativeMarks: 0,
});

const BULK_PLACEHOLDER = `Paste your questions in this format:

1. Which property sets the size of text?
A) text-size
B) font-style
C) font-size
D) text-style
Answer: C

2. Which property makes text bold?
A) font-weight
B) font-style
C) text-bold
D) font-thickness
Answer: A`;

export default function QuestionFormDialog({ open, onOpenChange, editing, lockedMeta, pending, onSave, onBulkSave }: Props) {
  const [mode, setMode] = useState<"manual" | "bulk">("manual");
  const [form, setForm] = useState<QuestionPayload>(emptyForm());
  const [bulkText, setBulkText] = useState("");
  const [bulkMeta, setBulkMeta] = useState({ subject: "", topic: "", marks: 2, negativeMarks: 0 });

  useEffect(() => {
    if (!open) return;
    setMode("manual");
    setBulkText("");
    if (editing) {
      setForm({
        subject: editing.subject,
        topic: editing.topic,
        questionText: editing.questionText,
        options: [...editing.options, "", "", "", ""].slice(0, Math.max(4, editing.options.length)),
        correctAnswer: editing.correctAnswer,
        marks: editing.marks,
        negativeMarks: editing.negativeMarks,
      });
    } else {
      setForm({ ...emptyForm(), ...(lockedMeta || {}) });
    }
  }, [open, editing, lockedMeta]);

  const meta = lockedMeta;
  const parsedCount = bulkText.trim() ? parseBulkQuestions(bulkText).length : 0;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, ...(meta || {}), options: form.options.map((o) => o.trim()) });
  };

  const submitBulk = () => {
    const subject = meta?.subject ?? bulkMeta.subject;
    const topic = meta?.topic ?? bulkMeta.topic;
    const parsed = parseBulkQuestions(bulkText);
    onBulkSave(parsed.map((q) => ({
      subject,
      topic,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: bulkMeta.marks,
      negativeMarks: bulkMeta.negativeMarks,
    })));
  };

  const metaFields = (values: { subject: string; topic: string }, set: (v: { subject: string; topic: string }) => void) =>
    meta ? null : (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={values.subject} onChange={(e) => set({ ...values, subject: e.target.value })} placeholder="e.g. Mathematics" required data-testid="input-question-subject" />
        </div>
        <div className="space-y-2">
          <Label>Topic</Label>
          <Input value={values.topic} onChange={(e) => set({ ...values, topic: e.target.value })} placeholder="e.g. Algebra" required data-testid="input-question-topic" />
        </div>
      </div>
    );

  const manualForm = (
    <form className="space-y-4" onSubmit={submitManual}>
      {metaFields({ subject: form.subject, topic: form.topic }, (v) => setForm({ ...form, ...v }))}
      <div className="space-y-2">
        <Label>Question Text</Label>
        <Textarea value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} placeholder="Enter the question..." required data-testid="input-question-text" />
      </div>
      <div className="space-y-3">
        <Label>Options (select the correct answer)</Label>
        <RadioGroup value={String(form.correctAnswer)} onValueChange={(v) => setForm({ ...form, correctAnswer: Number(v) })}>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <RadioGroupItem value={String(i)} id={`mcq-opt-${i}`} data-testid={`radio-option-${i}`} />
              <Input
                className="flex-1"
                value={opt}
                onChange={(e) => {
                  const options = [...form.options];
                  options[i] = e.target.value;
                  setForm({ ...form, options });
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                required
                data-testid={`input-option-${i}`}
              />
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Marks</Label>
          <Input type="number" min={0} step="any" value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} data-testid="input-question-marks" />
        </div>
        <div className="space-y-2">
          <Label>Negative Marks</Label>
          <Input type="number" min={0} step="any" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: Number(e.target.value) })} data-testid="input-question-negative-marks" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending} data-testid="button-submit-question">
        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {editing ? "Update Question" : "Create Question"}
      </Button>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Question" : "Add Questions"}</DialogTitle>
        </DialogHeader>
        {editing ? manualForm : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "bulk")}>
            <TabsList className="w-full">
              <TabsTrigger value="manual" className="flex-1"><Plus className="w-3.5 h-3.5 mr-1.5" />Manual</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1"><Upload className="w-3.5 h-3.5 mr-1.5" />Bulk Add</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">{manualForm}</TabsContent>
            <TabsContent value="bulk">
              <div className="space-y-4">
                {metaFields({ subject: bulkMeta.subject, topic: bulkMeta.topic }, (v) => setBulkMeta({ ...bulkMeta, ...v }))}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Marks per question</Label>
                    <Input type="number" min={0} step="any" value={bulkMeta.marks} onChange={(e) => setBulkMeta({ ...bulkMeta, marks: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Negative marks</Label>
                    <Input type="number" min={0} step="any" value={bulkMeta.negativeMarks} onChange={(e) => setBulkMeta({ ...bulkMeta, negativeMarks: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Paste Questions</Label>
                  <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={BULK_PLACEHOLDER} className="min-h-[200px] font-mono text-xs" data-testid="input-bulk-questions" />
                </div>
                {bulkText.trim() && <p className="text-xs text-muted-foreground">{parsedCount} question(s) detected</p>}
                <Button
                  className="w-full"
                  disabled={pending || parsedCount === 0 || (!meta && (!bulkMeta.subject.trim() || !bulkMeta.topic.trim()))}
                  onClick={submitBulk}
                  data-testid="button-submit-bulk"
                >
                  {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Upload className="w-4 h-4 mr-2" />
                  Add All Questions
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
