import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMcqApi } from "@/mcq/lib/api";
import { formatDuration } from "@/tickets/lib/types";

interface Article {
  _id: string;
  title: string;
  category: string;
  body?: string;
  status: "draft" | "published";
  roles: string[];
  orgTypes: string[];
  indexState: string;
}

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

const ROLES = [
  { value: "org_admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "teacher", label: "Teacher" },
  { value: "employee", label: "Employee" },
  { value: "student", label: "Student" },
];
const EMPTY = { title: "", category: "General", body: "", status: "draft" as Article["status"], roles: [] as string[], orgTypes: [] as string[] };
const INDEX_LABELS: Record<string, string> = { indexed: "Indexed", text_only: "Text search only", failed: "Failed", none: "Not indexed" };
const URL = "/api/assistant/knowledge";

function KnowledgeTab() {
  const api = useMcqApi();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY);
  const { data: articles } = useQuery({ queryKey: [URL], queryFn: () => api.get<Article[]>(URL) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [URL] });
  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });
  const reset = () => { setEditing(undefined); setForm(EMPTY); };

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`${URL}/${editing}`, form) : api.post(URL, form)),
    onSuccess: () => { refresh(); reset(); toast({ title: "Saved" }); },
    onError,
  });
  const edit = useMutation({
    mutationFn: (id: string) => api.get<Article>(`${URL}/${id}`),
    onSuccess: (a) => { setEditing(a._id); setForm({ title: a.title, category: a.category, body: a.body || "", status: a.status, roles: a.roles, orgTypes: a.orgTypes }); },
    onError,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`${URL}/${id}`), onSuccess: refresh, onError });
  const reindex = useMutation({
    mutationFn: () => api.post<{ reindexed: number }>(`${URL}/reindex/all`),
    onSuccess: (r) => { refresh(); toast({ title: `${r.reindexed} articles re-indexed` }); },
    onError,
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api.post(`${URL}/upload`, body);
    },
    onSuccess: () => { refresh(); toast({ title: "Uploaded as a draft", description: "Review it, then publish it." }); },
    onError,
  });

  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((v) => v !== value));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="article-title">Title</Label>
                <Input id="article-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-article-title" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="article-category">Category</Label>
                <Input id="article-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Publication</Label>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as Article["status"] })}>
                  <SelectTrigger data-testid="select-article-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="article-body">Content</Label>
              <Textarea id="article-body" required rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="input-article-body" />
            </div>
            <fieldset className="flex gap-3 flex-wrap">
              <legend className="text-sm font-medium mb-1">Visible to (none ticked means everyone)</legend>
              {ROLES.map((role) => (
                <label key={role.value} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={form.roles.includes(role.value)} onCheckedChange={(on) => setForm({ ...form, roles: toggle(form.roles, role.value, !!on) })} />
                  {role.label}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2 flex-wrap items-center">
              <Button type="submit" disabled={save.isPending} data-testid="button-save-article">{editing ? "Update Article" : "Add Article"}</Button>
              {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
              <Button type="button" variant="outline" disabled={reindex.isPending} onClick={() => reindex.mutate()}>Re-index All</Button>
              <Input type="file" accept=".pdf,.md,.txt" className="w-64" aria-label="Upload a PDF, Markdown or text file" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = ""; }} />
            </div>
          </form>
        </CardContent>
      </Card>
      {articles?.length === 0 && <p className="text-sm text-muted-foreground">No articles yet</p>}
      {articles?.map((a) => (
        <Card key={a._id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.category} · {a.roles.length ? a.roles.join(", ") : "Everyone"} · {INDEX_LABELS[a.indexState]}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={a.status === "published" ? "default" : "secondary"}>{a.status === "published" ? "Published" : "Draft"}</Badge>
              <Button variant="outline" size="sm" onClick={() => edit.mutate(a._id)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(a._id)}>Remove</Button>
            </div>
          </CardContent>
        </Card>
      ))}
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
    onSuccess: () => { refreshUser(); toast({ title: "Saved" }); },
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
          <p className="text-xs text-muted-foreground">The API key is set in the server environment and can't be viewed or changed here.</p>
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
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage what the assistant knows and see how it's used</p>
      </div>
      <Tabs defaultValue="knowledge">
        <TabsList>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-assistant-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="knowledge" className="mt-4"><KnowledgeTab /></TabsContent>
        <TabsContent value="monitoring" className="mt-4"><MonitoringTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
