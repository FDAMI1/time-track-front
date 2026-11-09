import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Search, Wallet } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { formatMoney, INVOICE_STATUSES, peopleOptions, toMinor, toOptions, type InvoiceList, type Person } from "@/academy/lib/academy";
import { ListState, Pager, Picker, StatusBadge } from "@/academy/components/common";
import InvoiceDialog from "@/academy/components/InvoiceDialog";
import FeePlans from "@/academy/components/FeePlans";
import FeeReportPanel from "@/academy/components/FeeReportPanel";

const EMPTY = { studentId: "", title: "", amount: "", dueDate: "" };

function Invoices({ isAdmin, isStudent }: { isAdmin: boolean; isStudent: boolean }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState("");
  const set = (field: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/fees", "invoices", params.toString()],
    queryFn: () => api.get<InvoiceList>(`/api/fees/invoices?${params}`),
  });
  const { data: students } = useQuery({
    queryKey: ["/api/users", "student"],
    queryFn: () => api.get<Person[]>("/api/users?role=student"),
    enabled: isAdmin,
  });

  const create = useMutation({
    mutationFn: () => {
      const amountMinor = toMinor(form.amount);
      if (!amountMinor) throw new Error("Enter an amount such as 1500 or 1500.50");
      return api.post("/api/fees/invoices", { studentId: form.studentId, title: form.title, amountMinor, dueDate: form.dueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Invoice created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const invoices = data?.invoices || [];

  return (
    <div className="space-y-4">
      {!isStudent && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search student, invoice or fee" aria-label="Search invoices" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} data-testid="input-invoice-search" />
          </div>
          <Picker label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={toOptions(INVOICE_STATUSES)} allLabel="All statuses" testId="filter-invoice-status" />
          {isAdmin && <Button onClick={() => setCreateOpen(true)} data-testid="button-new-invoice"><Plus className="w-4 h-4 mr-2" />New Invoice</Button>}
        </div>
      )}

      <ListState isLoading={isLoading} error={error} isEmpty={invoices.length === 0} emptyText="No invoices found" icon={Wallet}>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card key={invoice._id} data-testid={`card-invoice-${invoice.invoiceKey}`}>
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{invoice.invoiceKey}</span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <button type="button" className="block mt-1 font-medium text-left hover:underline break-words" onClick={() => setOpenId(invoice._id)} data-testid={`button-open-invoice-${invoice.invoiceKey}`}>{invoice.title}</button>
                  <p className="text-xs text-muted-foreground mt-1">{isStudent ? "" : `${invoice.studentName} · `}Due {invoice.dueDate}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(invoice.amountMinor)}</p>
                  {invoice.balanceMinor > 0 && invoice.paidMinor > 0 && <p className="text-xs text-muted-foreground">{formatMoney(invoice.balanceMinor)} left</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ListState>

      <Pager page={page} pages={data?.pages || 1} onChange={setPage} />

      {openId && <InvoiceDialog id={openId} isAdmin={isAdmin} onClose={() => setOpenId("")} />}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
            <DialogDescription>To bill a whole batch or course at once, use Plans.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Picker label="Student" value={form.studentId} onChange={(v) => set("studentId", v)} options={peopleOptions(students)} testId="select-invoice-student" />
            <div className="space-y-1">
              <Label htmlFor="invoice-title">Fee</Label>
              <Input id="invoice-title" required maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} data-testid="input-invoice-title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="invoice-amount">Amount (₹)</Label>
                <Input id="invoice-amount" required inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} data-testid="input-invoice-amount" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invoice-due">Due date</Label>
                <Input id="invoice-due" type="date" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} data-testid="input-invoice-due" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending || !form.studentId} data-testid="button-submit-invoice">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Invoice
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FeesPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "org_admin";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="page-title">{isStudent ? "My Fees" : "Fees"}</h1>
        <p className="text-muted-foreground text-sm mt-1">Records of fees charged and paid. Payments aren't taken online.</p>
      </div>
      {isStudent ? <Invoices isAdmin={false} isStudent /> : (
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" data-testid="tab-fees-invoices">Invoices</TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-fees-plans">Plans</TabsTrigger>
            <TabsTrigger value="report" data-testid="tab-fees-report">Report</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices"><Invoices isAdmin={isAdmin} isStudent={false} /></TabsContent>
          <TabsContent value="plans"><FeePlans isAdmin={isAdmin} /></TabsContent>
          <TabsContent value="report"><FeeReportPanel /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
