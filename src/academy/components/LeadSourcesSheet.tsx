import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import LeadRotationCard from "@/academy/components/LeadRotationCard";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { labelOf, type LeadTemplate } from "@/academy/lib/academy";

const KEY = "/api/lead-integrations";
const TEMPLATES = ["/api/enquiries", "templates"];
const PROVIDERS = [
  { value: "meta", label: "Meta (Facebook and Instagram) Lead Ads", secrets: [["appSecret", "App secret"], ["accessToken", "Page access token"], ["verifyToken", "Verify token (the same one you type in Meta's webhook setup)"]] },
  { value: "whatsapp", label: "WhatsApp Business", secrets: [["appSecret", "App secret"]] },
  { value: "google", label: "Google Ads lead forms", secrets: [["googleKey", "Webhook key"]] },
  { value: "website", label: "Website enquiry form", secrets: [] },
];

interface Integration {
  _id: string;
  provider: string;
  isEnabled: boolean;
  fieldMap?: { name?: string; phone?: string; email?: string };
  lastReceivedAt?: string;
  lastError?: string;
  saved: string[];
}

interface LeadEvent {
  _id: string;
  status: string;
  error: string;
  createdAt: string;
  integrationId?: { provider: string };
  enquiryId?: { name: string };
}

export default function LeadSourcesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const [provider, setProvider] = useState("meta");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [address, setAddress] = useState("");
  const [drafts, setDrafts] = useState<LeadTemplate[] | null>(null);
  const current = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];

  const { data: items } = useQuery({ queryKey: [KEY], queryFn: () => api.get<Integration[]>(KEY), enabled: open });
  const { data: events } = useQuery({ queryKey: [KEY, "events"], queryFn: () => api.get<LeadEvent[]>(`${KEY}/events`), enabled: open });
  const item = items?.find((i) => i.provider === provider);
  const { data: saved } = useQuery({ queryKey: TEMPLATES, queryFn: () => api.get<LeadTemplate[]>("/api/enquiries/templates"), enabled: open });
  const templates = drafts ?? saved ?? [];
  const setTemplate = (index: number, field: keyof LeadTemplate, value: string) => setDrafts(templates.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  const saveTemplates = useMutation({
    mutationFn: () => api.put<LeadTemplate[]>("/api/enquiries/templates", { templates }),
    onSuccess: () => { setDrafts(null); queryClient.invalidateQueries({ queryKey: TEMPLATES }); toast({ title: "Templates saved" }); },
    onError: (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" }),
  });

  const showAddress = (id: string, token?: string) => {
    if (token) setAddress(`${import.meta.env.VITE_API_URL || window.location.origin}/api/lead-hooks/${id}/${token}`);
  };
  const failed = (err: Error) => toast({ title: "Not saved", description: err.message, variant: "destructive" });
  const save = useMutation({
    mutationFn: (body: object) => api.put<Integration & { token?: string }>(`${KEY}/${provider}`, body),
    onSuccess: (result) => {
      showAddress(result._id, result.token);
      setSecrets({});
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast({ title: "Saved" });
    },
    onError: failed,
  });
  const retry = useMutation({
    mutationFn: (eventId: string) => api.post(`${KEY}/events/${eventId}/retry`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [KEY] }); toast({ title: "Lead received" }); },
    onError: (err: Error) => { queryClient.invalidateQueries({ queryKey: [KEY] }); toast({ title: "Still failing", description: err.message, variant: "destructive" }); },
  });
  const rotate = useMutation({
    mutationFn: () => api.post<{ _id: string; token: string }>(`${KEY}/${provider}/rotate`),
    onSuccess: (result) => showAddress(result._id, result.token),
    onError: failed,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-lead-sources">
        <SheetHeader>
          <SheetTitle>Lead sources</SheetTitle>
          <SheetDescription>Connect the places your leads come from, and write the WhatsApp messages your team sends them.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label>Source</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v); setAddress(""); setSecrets({}); }}>
              <SelectTrigger data-testid="select-lead-provider"><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="lead-enabled">Receive leads</Label>
            <Switch id="lead-enabled" checked={!!item?.isEnabled} onCheckedChange={(isEnabled) => save.mutate({ isEnabled })} data-testid="switch-lead-enabled" />
          </div>

          {current.secrets.map(([name, label]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`lead-${name}`}>{label}</Label>
              <Input
                id={`lead-${name}`}
                type="password"
                autoComplete="off"
                placeholder={item?.saved.includes(name) ? "Saved. Type to replace" : ""}
                value={secrets[name] || ""}
                onChange={(e) => setSecrets((s) => ({ ...s, [name]: e.target.value }))}
                data-testid={`input-lead-${name}`}
              />
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(secrets)} data-testid="button-save-lead-source">Save</Button>
            {item && <Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => rotate.mutate()} data-testid="button-new-webhook">New webhook address</Button>}
          </div>

          {address && (
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium">Webhook address</p>
              <p className="text-xs text-muted-foreground">Copy this now. It won't be shown again.</p>
              <p className="text-xs break-all font-mono" data-testid="text-webhook-address">{address}</p>
            </div>
          )}

          {item?.lastError && <p className="text-sm text-destructive">Last error: {item.lastError}</p>}
          {item?.lastReceivedAt && <p className="text-sm text-muted-foreground">Last lead received {new Date(item.lastReceivedAt).toLocaleString()}</p>}

          <LeadRotationCard />

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">WhatsApp templates</p>
            <p className="text-xs text-muted-foreground">{"{name}"}, {"{org}"}, {"{course}"} and {"{agent}"} are filled in for each lead.</p>
            {templates.map((t, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3" data-testid={`template-${i}`}>
                <Input placeholder="Template name" aria-label="Template name" maxLength={60} value={t.name} onChange={(e) => setTemplate(i, "name", e.target.value)} data-testid={`input-template-name-${i}`} />
                <Textarea rows={3} placeholder="Message" aria-label="Template message" maxLength={1000} value={t.body} onChange={(e) => setTemplate(i, "body", e.target.value)} data-testid={`input-template-body-${i}`} />
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setDrafts(templates.filter((_, j) => j !== i))} data-testid={`button-remove-template-${i}`}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={templates.length >= 20} onClick={() => setDrafts([...templates, { name: "", body: "" }])} data-testid="button-add-template">Add template</Button>
              {drafts && <Button type="button" size="sm" disabled={saveTemplates.isPending} onClick={() => saveTemplates.mutate()} data-testid="button-save-templates">Save templates</Button>}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Recent activity</p>
            {events?.length === 0 && <p className="text-sm text-muted-foreground">Nothing received yet</p>}
            {events?.map((event) => (
              <div key={event._id} className="text-xs" data-testid={`lead-event-${event.status}`}>
                <span className="font-medium">{labelOf(event.status)}</span>
                {` · ${event.integrationId?.provider || ""} · ${event.enquiryId?.name || event.error || ""} · ${new Date(event.createdAt).toLocaleString()}`}
                {event.status === "failed" && event.integrationId?.provider === "meta" && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-1" disabled={retry.isPending} onClick={() => retry.mutate(event._id)} data-testid={`button-retry-${event._id}`}>Retry</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
