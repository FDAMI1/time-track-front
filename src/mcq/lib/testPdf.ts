import { jsPDF } from "jspdf";
import type { McqTestDetail } from "./types";

const LABELS = ["A", "B", "C", "D", "E", "F"];

// Renders a test (questions + answer key) to a PDF, optionally over a
// full-page background template image.
export function generateTestPDF(test: McqTestDetail, templateBase64: string | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const hasTemplate = !!templateBase64;
  const topMargin = hasTemplate ? 43 : 15;
  const bottomMargin = hasTemplate ? 20 : 15;
  const sideMargin = 20;
  const contentWidth = pageWidth - sideMargin * 2;
  const maxY = pageHeight - bottomMargin;
  let y = topMargin;

  const paintPage = () => {
    if (!templateBase64) return;
    try {
      doc.addImage(templateBase64, templateBase64.includes("image/png") ? "PNG" : "JPEG", 0, 0, pageWidth, pageHeight);
      doc.setFillColor(255, 255, 255);
      doc.rect(sideMargin - 5, topMargin - 3, contentWidth + 10, maxY - topMargin + 6, "F");
    } catch {
      /* ignore template rendering failures */
    }
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > maxY) {
      doc.addPage();
      paintPage();
      y = topMargin;
    }
  };

  paintPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const title = test.title || "Test";
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 8;

  if (test.description) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(test.description, pageWidth / 2, y, { align: "center" });
    y += 8;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Duration: ${test.duration} min  |  Max Attempts: ${test.maxAttempts}  |  Total Questions: ${test.questions?.length || 0}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;
  doc.setDrawColor(180);
  doc.line(sideMargin, y, pageWidth - sideMargin, y);
  y += 10;

  const questions = test.questions || [];
  questions.forEach((tq, idx) => {
    const q = tq.question;
    checkPageBreak(50);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(`Q${idx + 1}. ${q.questionText || "(No question text)"}`, contentWidth);
    doc.text(qLines, sideMargin, y);
    y += qLines.length * 5 + 2;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`(${q.marks || 0} marks${(q.negativeMarks || 0) > 0 ? `, -${q.negativeMarks} negative` : ""})`, sideMargin, y);
    y += 6;

    doc.setFontSize(10);
    (q.options || []).forEach((opt, i) => {
      checkPageBreak(8);
      const optLines = doc.splitTextToSize(`    ${LABELS[i] || i + 1}) ${opt}`, contentWidth - 10);
      doc.text(optLines, sideMargin, y);
      y += optLines.length * 5 + 1;
    });
    y += 6;
  });

  checkPageBreak(20);
  y += 5;
  doc.setDrawColor(180);
  doc.line(sideMargin, y, pageWidth - sideMargin, y);
  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Answer Key", sideMargin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  questions.forEach((tq, idx) => {
    checkPageBreak(7);
    doc.text(`Q${idx + 1}: ${LABELS[tq.question.correctAnswer] || "?"}`, sideMargin, y);
    y += 6;
  });

  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}_MCQ.pdf`);
}
