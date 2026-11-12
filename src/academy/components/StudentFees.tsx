import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMcqApi } from "@/mcq/lib/api";
import { formatMoney, labelOf, type StudentAccount } from "@/academy/lib/academy";
import { StatusBadge } from "@/academy/components/common";
import InvoiceDialog, { ReceiptDialog } from "@/academy/components/InvoiceDialog";

const Stat = ({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) => (
  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="text-lg font-semibold" data-testid={testId}>{value}</div></div>
);
const dateOf = (iso?: string) => (iso ? iso.slice(0, 10) : "");

// A student's fees inside their profile. It reads the Fees module's own records, and opens the Fees
// module's invoice and receipt dialogs, so a payment made here or on the Fees page shows in both.
export default function StudentFees({ studentId, isAdmin }: { studentId: string; isAdmin: boolean }) {
  const api = useMcqApi();
  const [openId, setOpenId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const { data, isLoading, error } = useQuery({
    // Under "/api/fees", so every fee change (here or on the Fees page) refreshes it.
    queryKey: ["/api/fees", "student", studentId],
    queryFn: () => api.get<StudentAccount>(`/api/fees/students/${studentId}`),
  });

  return (
    <Card data-testid="section-fees">
      <CardHeader className="pb-2"><CardTitle className="text-base">Fees &amp; Payments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Total fees" value={formatMoney(data.summary.billedMinor)} testId="stat-fees-billed" />
              <Stat label="Paid" value={formatMoney(data.summary.paidMinor)} testId="stat-fees-paid" />
              <Stat label="Outstanding" value={formatMoney(data.summary.outstandingMinor)} testId="stat-fees-outstanding" />
              <Stat label="Overdue" value={<span className={data.summary.overdueMinor ? "text-destructive" : ""}>{formatMoney(data.summary.overdueMinor)}</span>} testId="stat-fees-overdue" />
              <Stat label="Next due" value={data.summary.nextDueDate || "—"} testId="stat-fees-next-due" />
              <Stat label="Status" value={data.summary.status === "none" ? <span className="text-sm text-muted-foreground">No fees</span> : <StatusBadge status={data.summary.status} />} testId="stat-fees-status" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Invoices</p>
              {!data.invoices.length && <p className="text-sm text-muted-foreground">No invoices for this student.</p>}
              {data.invoices.map((invoice) => (
                <div key={invoice._id} className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between" data-testid={`student-invoice-${invoice.invoiceKey}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{invoice.invoiceKey}</span>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <p className="font-medium break-words">{invoice.title}</p>
                    <p className="text-xs text-muted-foreground">Invoiced {dateOf(invoice.createdAt)} · Due {invoice.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap sm:justify-end">
                    <dl className="grid grid-cols-3 gap-3 text-xs text-right">
                      <div><dt className="text-muted-foreground">Total</dt><dd className="font-medium">{formatMoney(invoice.amountMinor)}</dd></div>
                      <div><dt className="text-muted-foreground">Paid</dt><dd className="font-medium">{formatMoney(invoice.paidMinor)}</dd></div>
                      <div><dt className="text-muted-foreground">Remaining</dt><dd className="font-medium">{formatMoney(invoice.balanceMinor)}</dd></div>
                    </dl>
                    <Button size="sm" variant="outline" onClick={() => setOpenId(invoice._id)} data-testid={`button-student-invoice-${invoice.invoiceKey}`}>
                      {isAdmin && invoice.balanceMinor > 0 ? "Record payment" : "View"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Payment history</p>
              {!data.payments.length && <p className="text-sm text-muted-foreground">No payments yet.</p>}
              {!!data.payments.length && (
                <ul className="divide-y rounded-md border text-sm" data-testid="list-student-payments">
                  {data.payments.map((p) => (
                    <li key={p._id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-testid={`student-payment-${p.receiptKey}`}>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.kind === "reversal" ? "Reversal " : ""}{formatMoney(p.amountMinor)}
                          <span className="font-normal text-muted-foreground"> · {p.date} · {labelOf(p.method)}</span>
                          {p.reversed && <span className="text-xs text-destructive"> · Reversed</span>}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {[`${p.invoiceId.invoiceKey} ${p.invoiceId.title}`, p.reference && `Ref ${p.reference}`, p.notes].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setReceiptId(p._id)} data-testid={`button-student-receipt-${p.receiptKey}`}>Receipt</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
      {openId && <InvoiceDialog id={openId} isAdmin={isAdmin} onClose={() => setOpenId("")} />}
      {receiptId && <ReceiptDialog id={receiptId} onClose={() => setReceiptId("")} />}
    </Card>
  );
}
