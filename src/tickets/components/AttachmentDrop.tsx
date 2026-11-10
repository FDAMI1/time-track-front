import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { FileText, ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

// The server's attachment rules (routes/tickets/tickets.js): up to 5 PDF, PNG or JPG files, 5 MB each.
export const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };
const EXTENSIONS: Record<string, string[]> = { png: [".png"], jpg: [".jpg", ".jpeg"], pdf: [".pdf"] };

// A pasted screenshot arrives as "image.png"; give it a name the server accepts and people recognise.
function normalise(file: File, index: number): File | null {
  const kind = TYPES[file.type];
  if (!kind) return null;
  const lower = file.name.toLowerCase();
  if (file.name && EXTENSIONS[kind].some((ext) => lower.endsWith(ext)) && lower !== "image.png") return file;
  return new File([file], `screenshot-${Date.now()}-${index + 1}.${kind}`, { type: file.type });
}

export function useAttachments() {
  const { toast } = useToast();
  const [files, setState] = useState<File[]>([]);
  // The latest list, so two adds in quick succession (paste then drop) both count.
  const latest = useRef<File[]>([]);
  const setFiles = (next: File[]) => { latest.current = next; setState(next); };

  const add = (incoming: File[]) => {
    const problems = new Set<string>();
    const next = [...latest.current];
    incoming.forEach((raw, i) => {
      const file = normalise(raw, next.length + i);
      if (!file) return problems.add(`${raw.name || "That item"} isn't a PDF, PNG or JPG file`);
      if (file.size > MAX_BYTES) return problems.add(`${file.name} is larger than 5 MB`);
      if (next.length >= MAX_FILES) return problems.add(`Only ${MAX_FILES} attachments can be added`);
      next.push(file);
    });
    setFiles(next);
    if (problems.size) toast({ title: "Some files were not added", description: [...problems].join(". "), variant: "destructive" });
  };

  // For a text box: a pasted image becomes an attachment, pasted text stays text.
  const onPaste = (e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData?.files || []);
    if (!pasted.length) return;
    e.preventDefault();
    add(pasted);
  };

  return { files, add, onPaste, remove: (index: number) => setFiles(latest.current.filter((_, i) => i !== index)), clear: () => setFiles([]) };
}

export type Attachments = ReturnType<typeof useAttachments>;

function Preview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <li className="relative w-24 rounded-md border bg-background overflow-hidden" data-testid="attachment-preview">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={file.name} className="h-20 w-full object-cover" /></a>
      ) : (
        <div className="h-20 flex items-center justify-center text-muted-foreground"><FileText className="w-8 h-8" /></div>
      )}
      <p className="px-1 py-0.5 text-[11px] truncate" title={file.name}>{file.name}</p>
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 shadow hover:bg-destructive hover:text-destructive-foreground" data-testid="button-remove-attachment">
        <X className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

// Choose Files, paste (Ctrl/Cmd + V) or drag and drop, with previews and remove.
export default function AttachmentDrop({ attachments, id }: { attachments: Attachments; id?: string }) {
  const [over, setOver] = useState(false);
  const { files, add, remove, onPaste } = attachments;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(Array.from(e.dataTransfer.files || []));
  };
  return (
    <div className="space-y-2">
      <div
        tabIndex={0}
        role="button"
        aria-label="Paste or drop attachments here"
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-md border border-dashed p-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${over ? "border-primary bg-primary/5" : ""}`}
        data-testid="attachment-drop"
      >
        <p className="flex items-center gap-2"><ImagePlus className="w-4 h-4 shrink-0" />Paste screenshots here using Ctrl + V or drag and drop images</p>
        <Input
          id={id}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          className="mt-2"
          aria-label="Choose files"
          onChange={(e) => { add(Array.from(e.target.files || [])); e.target.value = ""; }}
          data-testid="input-attachments"
        />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attachments">
          {files.map((file, i) => <Preview key={`${file.name}-${i}`} file={file} onRemove={() => remove(i)} />)}
        </ul>
      )}
    </div>
  );
}
