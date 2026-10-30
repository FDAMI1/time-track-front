import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { capitalize, PRIORITIES, SCALE, TICKET_TYPES, type Ticket, type TicketMeta } from "@/tickets/lib/types";

const EMPTY = { subject: "", description: "", categoryId: "", subcategory: "", type: "incident", priority: "medium", urgency: "medium", impact: "medium", source: "portal" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta?: TicketMeta;
}

export default function NewTicketDialog({ open, onOpenChange, meta }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const subcategories = meta?.categories.find((c) => c._id === form.categoryId)?.subcategories || [];

  const create = useMutation({
    mutationFn: () => {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (value && !(meta?.matrixEnabled ? key === "priority" : key === "urgency" || key === "impact")) body.append(key, value);
      }
      files.forEach((file) => body.append("files", file));
      return api.post<Ticket>("/api/tickets", body);
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      onOpenChange(false);
      setForm(EMPTY);
      setFiles([]);
      toast({ title: `Ticket ${ticket.ticketKey} created` });
      navigate(`/${ticket._id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
          <DialogDescription>Describe the problem. The support team will reply here.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" required maxLength={200} value={form.subject} onChange={(e) => set("subject", e.target.value)} data-testid="input-ticket-subject" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" required rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} data-testid="input-ticket-description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v, subcategory: "" }))}>
                <SelectTrigger data-testid="select-ticket-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{meta?.categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {subcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={form.subcategory} onValueChange={(v) => set("subcategory", v)}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {meta?.matrixEnabled ? (
              (["urgency", "impact"] as const).map((field) => (
                <div className="space-y-2" key={field}>
                  <Label>{capitalize(field)}</Label>
                  <Select value={form[field]} onValueChange={(v) => set(field, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SCALE.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                  <SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{capitalize(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {meta?.isAgent && (
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => set("source", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="walk_up">Walk-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-files">Attachments (up to 5 PDF, PNG or JPG files, 5 MB each)</Label>
            <Input id="ticket-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-ticket">
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Ticket
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
