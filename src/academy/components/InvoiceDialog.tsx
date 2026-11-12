import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { formatMoney, labelOf, localToday, PAYMENT_METHODS, toMinor, toOptions, type InvoiceDetail, type Payment, type Receipt } from "@/academy/lib/academy";
import { Picker, StatusBadge } from "@/academy/components/common";

export function ReceiptDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useMcqApi();
  const { data, error } = useQuery({ queryKey: ["/api/fees", "payment", id], queryFn: () => api.get<Receipt>(`/api/fees/payments/${id}`) });
  const rows: [string, string][] = data ? [
    ["Student", data.invoice.studentName],
    ["Fee", `${data.invoice.title} (${data.invoice.invoiceKey})`],
    ["Date", data.date],
    ["Amount", formatMoney(data.amountMinor)],
    ["Method", labelOf(data.method)],
    ...(data.reference ? [["Reference", data.reference] as [string, string]] : []),
  ] : [];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm" data-print-receipt>
        <DialogHeader>
          <DialogTitle>{data?.kind === "reversal" ? "Reversal" : "Receipt"} {data?.receiptKey}</DialogTitle>
          <DialogDescription>{data?.reversed ? "This payment was reversed." : "Record of a payment made to the academy."}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <dl className="text-sm space-y-1" data-testid="receipt-details">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right break-words min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" className="print:hidden" onClick={() => window.print()} data-testid="button-print-receipt">Print</Button>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  id: string;
  isAdmin: boolean;
  onClose: () => void;
}

export default function InvoiceDialog({ id, isAdmin, onClose }: Props) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [form, setForm] = useState({ amount: "", date: localToday(), method: "cash", reference: "", notes: "" });
  const [receiptId, setReceiptId] = useState("");
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const set = (field: keyof typeof form, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["/api/fees", "invoice", id],
    queryFn: () => api.get<InvoiceDetail>(`/api/fees/invoices/${id}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
  const failed = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const pay = useMutation({
    mutationFn: () => {
      const amountMinor = toMinor(form.amount);
      if (!amountMinor) throw new Error("Enter an amount such as 1500 or 1500.50");
      const { amount: _amount, ...rest } = form;
      return api.post(`/api/fees/invoices/${id}/payments`, { ...rest, amountMinor });
    },
    onSuccess: () => { setForm((f) => ({ ...f, amount: "", reference: "", notes: "" })); refresh(); toast({ title: "Payment recorded" }); },
    onError: failed,
  });
  const reverse = useMutation({
    mutationFn: () => api.post(`/api/fees/payments/${reversing?._id}/reverse`, { notes: reason }),
    onSuccess: () => { setReversing(null); setReason(""); refresh(); toast({ title: "Payment reversed" }); },
    onError: failed,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice?.title || "Invoice"}</DialogTitle>
          <DialogDescription>{invoice ? `${invoice.invoiceKey} · ${invoice.studentName} · Due ${invoice.dueDate}` : " "}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-48 w-full" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {invoice && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={invoice.status} />
              <span className="text-sm">{formatMoney(invoice.paidMinor)} paid of {formatMoney(invoice.amountMinor)}</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Payments</p>
              {invoice.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet</p>}
              {invoice.payments.map((p) => (
                <div key={p._id} className="rounded-lg bg-muted p-3 text-sm flex items-start justify-between gap-3 flex-wrap" data-testid={`payment-${p.receiptKey}`}>
                  <div className="min-w-0">
                    <p className="font-medium">{p.kind === "reversal" ? "Reversal " : ""}{formatMoney(p.amountMinor)}</p>
                    <p className="text-xs text-muted-foreground break-words">{[p.date, labelOf(p.method), p.reference, p.notes].filter(Boolean).join(" · ")}</p>
                    {p.reversed && <p className="text-xs text-destructive">Reversed</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setReceiptId(p._id)} data-testid={`button-receipt-${p.receiptKey}`}>Receipt</Button>
                    {isAdmin && p.kind === "payment" && !p.reversed && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReversing(p)} data-testid={`button-reverse-${p.receiptKey}`}>Reverse</Button>}
                  </div>
                </div>
              ))}
            </div>

            {reversing && (
              <form className="rounded-lg border p-3 space-y-2" onSubmit={(e) => { e.preventDefault(); reverse.mutate(); }}>
                <Label htmlFor="reverse-reason">Why is {formatMoney(reversing.amountMinor)} being reversed?</Label>
                <Input id="reverse-reason" required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-reverse-reason" />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="destructive" disabled={reverse.isPending} data-testid="button-confirm-reverse">Confirm Reversal</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReversing(null)}>Cancel</Button>
                </div>
              </form>
            )}

            {isAdmin && invoice.balanceMinor > 0 && (
              <form className="border-t pt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
                <p className="text-sm font-medium">Record a payment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="payment-amount">Amount (₹)</Label>
                    <Input id="payment-amount" required inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} data-testid="input-payment-amount" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="payment-date">Date</Label>
                    <Input id="payment-date" type="date" required max={localToday()} value={form.date} onChange={(e) => set("date", e.target.value)} data-testid="input-payment-date" />
                  </div>
                  <Picker label="Method" value={form.method} onChange={(v) => set("method", v)} options={toOptions(PAYMENT_METHODS)} testId="select-payment-method" />
                  <div className="space-y-1">
                    <Label htmlFor="payment-reference">Reference</Label>
                    <Input id="payment-reference" maxLength={120} value={form.reference} onChange={(e) => set("reference", e.target.value)} data-testid="input-payment-reference" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-notes">Notes (staff only)</Label>
                  <Input id="payment-notes" maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} data-testid="input-payment-notes" />
                </div>
                <Button type="submit" className="w-full" disabled={pay.isPending} data-testid="button-record-payment">
                  {pay.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Record Payment
                </Button>
              </form>
            )}
          </div>
        )}
        {receiptId && <ReceiptDialog id={receiptId} onClose={() => setReceiptId("")} />}
      </DialogContent>
    </Dialog>
  );
}
