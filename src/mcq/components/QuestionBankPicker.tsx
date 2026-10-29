import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import type { McqQuestion } from "@/mcq/lib/types";

interface Props {
  testId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Questions already in the test; they are shown but cannot be picked again.
  existingIds: string[];
  onAdded: (count: number) => void;
}

const PICK_LIMIT = 100;

// Adds questions that already exist in the question bank to a test, so a
// teacher does not have to retype questions for every test.
export default function QuestionBankPicker({ testId, open, onOpenChange, existingIds, onAdded }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const params = new URLSearchParams({ page: "1", limit: String(PICK_LIMIT) });
  if (search.trim()) params.set("search", search.trim());
  if (subject !== "all") params.set("subject", subject);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/mcq/questions", "picker", search, subject],
    queryFn: () => api.get<{ questions: McqQuestion[]; total: number }>(`/api/mcq/questions?${params}`),
    enabled: open,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["/api/mcq/questions/subjects"],
    queryFn: () => api.get<string[]>("/api/mcq/questions/subjects"),
    enabled: open,
  });

  const existing = new Set(existingIds);
  const questions = data?.questions || [];
  const available = questions.filter((q) => !existing.has(q._id));

  const add = useMutation({
    mutationFn: () => api.post(`/api/mcq/tests/${testId}/questions`, { questionIds: selected }),
    onSuccess: () => {
      onAdded(selected.length);
      setSelected([]);
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allPicked = available.length > 0 && available.every((q) => selected.includes(q._id));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected([]); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add from Question Bank</DialogTitle>
          <DialogDescription>Pick existing questions to add to this test.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search question text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search question bank"
              data-testid="input-picker-search"
            />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="sm:w-[180px]" aria-label="Filter by subject" data-testid="select-picker-subject"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No questions match. Create questions in the Question Bank first.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{selected.length} selected</Label>
              <Button
                variant="ghost"
                size="sm"
                disabled={available.length === 0}
                onClick={() => setSelected(allPicked ? [] : available.map((q) => q._id))}
                data-testid="button-picker-select-all"
              >
                {allPicked ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 border border-border rounded-md p-3">
              {questions.map((q) => {
                const inTest = existing.has(q._id);
                return (
                  <label key={q._id} className={`flex items-start gap-2 text-sm ${inTest ? "opacity-60" : "cursor-pointer"}`}>
                    <Checkbox
                      checked={inTest || selected.includes(q._id)}
                      disabled={inTest}
                      onCheckedChange={() => toggle(q._id)}
                      className="mt-0.5"
                      aria-label={q.questionText}
                      data-testid={`checkbox-bank-question-${q._id}`}
                    />
                    <span className="flex-1 text-foreground">{q.questionText}</span>
                    <span className="flex gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{q.subject}</Badge>
                      {inTest && <Badge variant="outline" className="text-[10px]">In test</Badge>}
                    </span>
                  </label>
                );
              })}
            </div>
            {data && data.total > PICK_LIMIT && (
              <p className="text-xs text-muted-foreground">Showing the first {PICK_LIMIT} of {data.total}. Search or filter to find others.</p>
            )}
            <Button className="w-full" disabled={selected.length === 0 || add.isPending} onClick={() => add.mutate()} data-testid="button-picker-add">
              {add.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add {selected.length} question(s)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
