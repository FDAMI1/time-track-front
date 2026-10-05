export interface ParsedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: number;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

// Parses pasted text in the form:
//   1. Question text
//   A) option   B) option   C) option   D) option
//   Answer: C
export function parseBulkQuestions(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let currentQuestion: string | null = null;
  let currentOptions: string[] = [];
  let currentCorrect = -1;

  function flush() {
    if (currentQuestion && currentOptions.length === 4 && currentCorrect >= 0 && currentOptions.every((o) => o.length > 0)) {
      questions.push({ questionText: currentQuestion, options: currentOptions, correctAnswer: currentCorrect });
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = -1;
  }

  for (const line of lines) {
    const answerMatch = line.match(/^(?:Answer|Ans)\s*:\s*\(?([A-Da-d])\)?/i);
    if (answerMatch) {
      currentCorrect = OPTION_LABELS.indexOf(answerMatch[1].toUpperCase());
      flush();
      continue;
    }

    const optionMatch = line.match(/^\(?([A-Da-d])\)?[.)\-\s]\s*(.*)/);
    if (optionMatch && currentQuestion !== null) {
      const idx = OPTION_LABELS.indexOf(optionMatch[1].toUpperCase());
      if (idx >= 0) {
        while (currentOptions.length < idx) currentOptions.push("");
        currentOptions[idx] = optionMatch[2].trim();
        continue;
      }
    }

    if (currentOptions.length > 0 && currentCorrect === -1) continue;

    if (currentQuestion !== null && currentOptions.length === 0) {
      currentQuestion += " " + line;
      continue;
    }

    flush();
    currentQuestion = line.replace(/^\d+[.)]\s*/, "").trim();
  }

  flush();
  return questions;
}
