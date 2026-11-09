import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import { formatDuration } from "@/tickets/lib/types";

interface Stats {
  messages: number;
  failed?: number;
  unanswered?: number;
  helpful?: number;
  notHelpful?: number;
  reported?: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs?: number;
  avgRetrievalScore?: number;
  estimatedCostUsd: number;
  unansweredQuestions: { _id: string; question: string }[];
  frequentQuestions: { _id: string; count: number }[];
}

interface Setup {
  hasKey: boolean;
  keyHint: string;
  knowledge: string;
  knowledgeUpdatedAt: string | null;
  minWords: number;
  maxWords: number;
  enabled: boolean;
  model: string;
  platformModel: string;
  platformAvailable: boolean;
  lastTest: { ok: boolean; at: string; message: string } | null;
}
interface ModelOption { id: string; label: string }

const SETUP_URL = "/api/assistant/admin/setup";
// The chat widget checks availability once per page load; ask it again after a setting changes.
const refreshWidget = () => queryClient.invalidateQueries({ queryKey: ["/api/assistant"] });
const countWords = (text: string) => (text.trim().match(/\S+/g) || []).length;

// The organization's own assistant: its Gemini key and what the assistant knows about the product.
function SetupTab() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data, isError, refetch } = useQuery({ queryKey: [SETUP_URL], queryFn: () => api.get<Setup>(SETUP_URL) });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });
  const saved = (next: Setup) => queryClient.setQueryData([SETUP_URL], next);

  const saveKey = useMutation({
    mutationFn: () => api.put<Setup>(`${SETUP_URL}/key`, { apiKey }),
    onSuccess: (next) => { saved(next); setApiKey(""); setShowKey(false); refreshWidget(); toast({ title: "API key saved" }); },
    onError,
  });
  const testKey = useMutation({
    mutationFn: () => api.post<{ message: string; setup: Setup }>(`${SETUP_URL}/test`),
    onSuccess: (res) => { saved(res.setup); toast({ title: "Connection works", description: res.message }); },
    onError: (err: Error) => { onError(err); queryClient.invalidateQueries({ queryKey: [SETUP_URL] }); },
  });
  const removeKey = useMutation({
    mutationFn: () => api.delete<Setup>(`${SETUP_URL}/key`),
    onSuccess: (next) => { saved(next); refreshWidget(); toast({ title: "API key removed" }); },
    onError,
  });
  const saveSettings = useMutation({
    mutationFn: (body: { enabled?: boolean; model?: string }) => api.put<Setup>(`${SETUP_URL}/settings`, body),
    onSuccess: (next) => { saved(next); refreshWidget(); toast({ title: "Assistant settings saved" }); },
    onError,
  });
  // The models this organization's own key may use, as Google lists them.
  const { data: models } = useQuery({
    queryKey: [SETUP_URL, "models", data?.keyHint],
    queryFn: () => api.get<ModelOption[]>(`${SETUP_URL}/models`),
    enabled: !!data?.hasKey,
  });
  const saveKnowledge = useMutation({
    mutationFn: (knowledge: string) => api.put<Setup>(`${SETUP_URL}/knowledge`, { knowledge }),
    onSuccess: (next) => { saved(next); setDraft(null); toast({ title: "Product knowledge saved" }); },
    onError,
  });

  if (isError) {
    return (
      <div className="flex items-center gap-3 text-sm" role="alert" data-testid="text-setup-error">
        <p className="text-destructive">The AI Assistant setup could not be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }
  if (!data) return null;
  const text = draft ?? data.knowledge;
  const words = countWords(text);
  const tooShort = words < data.minWords;
  const tooLong = words > data.maxWords;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Gemini AI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <label htmlFor="assistant-enabled" className="text-sm">
              <span className="font-medium">Gemini integration</span>
              <span className="block text-xs text-muted-foreground">Off: nobody in your organization uses AI (the assistant and ticket drafts).</span>
            </label>
            <Switch id="assistant-enabled" checked={data.enabled} disabled={saveSettings.isPending} onCheckedChange={(enabled) => saveSettings.mutate({ enabled })} data-testid="switch-assistant-enabled" />
          </div>
          <p className="text-sm" data-testid="text-key-status">
            {data.hasKey
              ? `A key ending in ${data.keyHint} is saved. Your organization uses only this key.`
              : data.platformAvailable
                ? "No key of your own yet. Your organization shares the platform's key, with an hourly limit. Add your own key for your own quota."
                : "No key saved yet. The assistant stays off until you add one."}
          </p>
          {data.lastTest && (
            <p className={`text-xs ${data.lastTest.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`} data-testid="text-key-last-test">
              Connection {data.lastTest.ok ? "working" : "failed"} · checked {new Date(data.lastTest.at).toLocaleString()}
            </p>
          )}
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); saveKey.mutate(); }}>
            <div className="relative flex-1">
              <Label htmlFor="gemini-key" className="sr-only">Gemini API key</Label>
              <Input id="gemini-key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder={data.hasKey ? "Paste a new key to replace it" : "Paste your Gemini API key"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="pr-10" data-testid="input-gemini-key" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showKey ? "Hide key" : "Show key"} data-testid="button-toggle-key">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button type="submit" disabled={!apiKey.trim() || saveKey.isPending} data-testid="button-save-key">{saveKey.isPending ? "Checking..." : data.hasKey ? "Replace Key" : "Save Key"}</Button>
          </form>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" disabled={!data.hasKey || testKey.isPending} onClick={() => testKey.mutate()} data-testid="button-test-key">{testKey.isPending ? "Testing..." : "Test Connection"}</Button>
            {data.hasKey && <Button variant="ghost" size="sm" disabled={removeKey.isPending} onClick={() => removeKey.mutate()} data-testid="button-remove-key">Remove Key</Button>}
          </div>
          {data.hasKey && (
            <div className="space-y-1 max-w-sm">
              <Label htmlFor="assistant-model">Model</Label>
              <select id="assistant-model" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={data.model} disabled={!models || saveSettings.isPending} onChange={(e) => saveSettings.mutate({ model: e.target.value })} data-testid="select-assistant-model">
                <option value="">Platform default ({data.platformModel})</option>
                {(models || []).map((m) => <option key={m.id} value={m.id}>{m.label} ({m.id})</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Only models Google offers for your key are listed. Flash-Lite is the fastest and cheapest.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Create a key in Google AI Studio. We check it with Google before saving, store it encrypted, and never show it again.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Product Knowledge</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Explain your portal in your own words: what it does, each module and how to use it, step-by-step tasks, roles and permissions, and common problems with their fixes. The assistant answers only from this text.</p>
          <Label htmlFor="product-knowledge" className="sr-only">Product knowledge</Label>
          <Textarea id="product-knowledge" rows={18} value={text} onChange={(e) => setDraft(e.target.value)} placeholder="Example: To raise a ticket, open Tickets in the sidebar and click New Ticket..." data-testid="input-product-knowledge" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className={`text-sm ${tooShort || tooLong ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite" data-testid="text-word-count">
              {words.toLocaleString()} / {data.maxWords.toLocaleString()} words
              {tooShort && ` · at least ${data.minWords} needed`}
              {tooLong && ` · ${(words - data.maxWords).toLocaleString()} over the limit`}
            </p>
            <div className="flex items-center gap-2">
              {data.knowledgeUpdatedAt && <span className="text-xs text-muted-foreground">Last saved {new Date(data.knowledgeUpdatedAt).toLocaleString()}</span>}
              {draft !== null && <Button variant="ghost" onClick={() => setDraft(null)}>Discard Changes</Button>}
              <Button disabled={tooShort || tooLong || draft === null || saveKnowledge.isPending} onClick={() => saveKnowledge.mutate(text)} data-testid="button-save-knowledge">{data.knowledge ? "Update" : "Save"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MonitoringTab() {
  const api = useMcqApi();
  const { data } = useQuery({ queryKey: ["/api/assistant/admin/stats"], queryFn: () => api.get<Stats>("/api/assistant/admin/stats") });
  if (!data) return null;
  const tiles = [
    { label: "Answers", value: data.messages },
    { label: "Unanswered", value: data.unanswered ?? 0 },
    { label: "Failed", value: data.failed ?? 0 },
    { label: "Helpful", value: data.helpful ?? 0 },
    { label: "Not helpful", value: data.notHelpful ?? 0 },
    { label: "Reported incorrect", value: data.reported ?? 0 },
    { label: "Average response", value: data.avgLatencyMs ? `${(data.avgLatencyMs / 1000).toFixed(1)}s` : formatDuration(null) },
    { label: "Retrieval quality", value: data.avgRetrievalScore ? data.avgRetrievalScore.toFixed(2) : formatDuration(null) },
    { label: "Tokens used", value: (data.inputTokens + data.outputTokens).toLocaleString() },
    { label: "Estimated cost", value: `$${data.estimatedCostUsd.toFixed(4)}` },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border bg-card p-4" data-testid={`stat-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="text-xl font-bold">{tile.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Unanswered Questions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.unansweredQuestions.length === 0 && <p className="text-muted-foreground">None</p>}
            {data.unansweredQuestions.map((q) => <p key={q._id} className="break-words">{q.question}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Frequent Questions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.frequentQuestions.length === 0 && <p className="text-muted-foreground">None</p>}
            {data.frequentQuestions.map((q) => <p key={q._id} className="break-words">{q.count} × {q._id}</p>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsTab() {
  const api = useMcqApi();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const superadmin = user?.role === "superadmin";
  const features = user?.organizationId?.features || {};
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const setFeature = useMutation({
    mutationFn: (change: Record<string, boolean>) => api.patch("/api/organizations/my/features", { features: change }),
    onSuccess: () => { refreshUser(); refreshWidget(); toast({ title: "Saved" }); },
    onError,
  });

  const configUrl = "/api/assistant/admin/config";
  const { data: config } = useQuery({
    queryKey: [configUrl],
    queryFn: () => api.get<{ provider: string | null; configured: boolean; hasKey: boolean; model?: string; maxTokens: number; temperature: number }>(configUrl),
    enabled: superadmin,
  });
  const [form, setForm] = useState({ model: "", maxTokens: 1024, temperature: 0.2 });
  useEffect(() => { if (config) setForm({ model: config.model || "", maxTokens: config.maxTokens, temperature: config.temperature }); }, [config]);
  const saveConfig = useMutation({
    mutationFn: () => api.put(configUrl, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [configUrl] }); toast({ title: "Saved" }); },
    onError,
  });

  if (superadmin) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">AI Provider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Provider: {config?.provider || "Not set"} · API key: {config?.hasKey ? "set" : "not set"} · {config?.configured ? "Ready" : "Not ready"}</p>
          <p className="text-xs text-muted-foreground">This is the platform key, set in the server environment. It is used only by organizations that haven't added their own key under AI Assistant → Setup.</p>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); saveConfig.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="ai-model">Model</Label>
              <Input id="ai-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-tokens">Maximum answer tokens</Label>
              <Input id="ai-tokens" type="number" min={100} max={8000} value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-temperature">Temperature</Label>
              <Input id="ai-temperature" type="number" min={0} max={1} step={0.1} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} />
            </div>
            <Button type="submit" className="md:col-span-3 w-fit">Save</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Assistant Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          Assistant is available to this organization
          <Switch checked={features.assistant !== false} onCheckedChange={(assistant) => setFeature.mutate({ assistant })} />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Answer questions about a person's own records. These records are sent to the AI provider to write the answer.</span>
          <Switch checked={features.assistantRecords !== false} onCheckedChange={(assistantRecords) => setFeature.mutate({ assistantRecords })} data-testid="switch-assistant-records" />
        </label>
      </CardContent>
    </Card>
  );
}

export default function AssistantAdminPage() {
  const { user } = useAuth();
  const superadmin = user?.role === "superadmin";
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground text-sm mt-1">{superadmin ? "See how the assistant is used across organizations" : "Set up the assistant that answers your members' questions"}</p>
      </div>
      <Tabs defaultValue={superadmin ? "monitoring" : "setup"}>
        <TabsList>
          {!superadmin && <TabsTrigger value="setup" data-testid="tab-assistant-setup">Setup</TabsTrigger>}
          <TabsTrigger value="monitoring" data-testid="tab-assistant-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        {!superadmin && <TabsContent value="setup" className="mt-4"><SetupTab /></TabsContent>}
        <TabsContent value="monitoring" className="mt-4"><MonitoringTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
