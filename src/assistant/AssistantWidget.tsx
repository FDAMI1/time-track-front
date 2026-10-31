import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Flag, History, Loader2, Maximize2, Minimize2, Plus, Send, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";
import ActionCard, { type AssistantAction } from "./ActionCard";

interface PageLink {
  label: string;
  path: string;
}

interface Source {
  articleId: string;
  title: string;
}

interface ChatMessage {
  _id: string;
  sender: "user" | "assistant";
  content: string;
  sources?: Source[];
  page?: PageLink;
  failed?: boolean;
  feedback?: { rating?: string; reportedIncorrect?: boolean };
}

interface TicketOffer {
  subject?: string;
  existing?: string;
}

interface AskResult {
  conversationId: string;
  message: ChatMessage;
  ticketOffer: TicketOffer | null;
  action: AssistantAction | null;
}

interface Conversation {
  _id: string;
  title: string;
}

interface ConversationDetail {
  conversation: Conversation & { hasPendingTicket: boolean };
  messages: ChatMessage[];
}

interface Status {
  available: boolean;
  suggestions: string[];
}

export default function AssistantWidget() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offer, setOffer] = useState<TicketOffer | null>(null);
  const [action, setAction] = useState<(AssistantAction & { messageId: string }) | null>(null);
  const [text, setText] = useState("");
  const [article, setArticle] = useState<{ title: string; body: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const scope = ["/api/assistant", user?._id];
  const { data: status } = useQuery({
    queryKey: [...scope, "status"],
    queryFn: () => api.get<Status>("/api/assistant/status"),
    refetchInterval: false,
    retry: false,
  });
  const { data: conversations } = useQuery({
    queryKey: [...scope, "conversations"],
    queryFn: () => api.get<Conversation[]>("/api/assistant/conversations"),
    enabled: showHistory,
    refetchInterval: false,
  });

  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [messages, offer, action]);

  const onError = (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const ask = useMutation({
    mutationFn: (message: string) => api.post<AskResult>("/api/assistant/messages", { message, conversationId: conversationId || undefined }),
    onMutate: (message) => {
      setOffer(null);
      setAction(null);
      setMessages((m) => [...m, { _id: `local-${Date.now()}`, sender: "user", content: message }]);
      setText("");
    },
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      setMessages((m) => [...m, result.message]);
      setOffer(result.ticketOffer);
      setAction(result.action ? { ...result.action, messageId: result.message._id } : null);
      queryClient.invalidateQueries({ queryKey: [...scope, "conversations"] });
    },
    onError,
  });

  const openConversation = useMutation({
    mutationFn: (id: string) => api.get<ConversationDetail>(`/api/assistant/conversations/${id}`),
    onSuccess: (detail) => {
      setConversationId(detail.conversation._id);
      setMessages(detail.messages);
      setOffer(detail.conversation.hasPendingTicket ? { subject: detail.conversation.title } : null);
      setAction(null);
      setShowHistory(false);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assistant/conversations/${id}`),
    onSuccess: (_data, id) => {
      if (id === conversationId) reset();
      queryClient.invalidateQueries({ queryKey: [...scope, "conversations"] });
    },
    onError,
  });

  const raiseTicket = useMutation({
    mutationFn: () => api.post<{ ticketId: string; ticketKey: string }>(`/api/assistant/conversations/${conversationId}/ticket`),
    onSuccess: (ticket) => {
      setOffer(null);
      setMessages((m) => [...m, { _id: `ticket-${ticket.ticketId}`, sender: "assistant", content: `Your ticket ${ticket.ticketKey} has been created. You can follow it under Tickets.` }]);
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError,
  });

  const feedback = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.post(`/api/assistant/messages/${id}/feedback`, body),
    onSuccess: (_data, { id, body }) => {
      setMessages((m) => m.map((message) => (message._id === id ? { ...message, feedback: body } : message)));
      toast({ title: "Thanks for the feedback" });
    },
    onError,
  });

  const openArticle = useMutation({
    mutationFn: (id: string) => api.get<{ title: string; body: string }>(`/api/assistant/articles/${id}`),
    onSuccess: setArticle,
    onError,
  });

  function reset() {
    setConversationId(null);
    setMessages([]);
    setOffer(null);
    setAction(null);
    setShowHistory(false);
  }

  const leaveFor = () => {
    setOpen(false);
    setFull(false);
  };

  const actionSaved = () => {
    if (!action) return;
    setMessages((m) => [...m, { _id: `ticket-${action.messageId}`, sender: "assistant", content: `Saved: ${action.label}.`, page: action.page }]);
    setAction(null);
    queryClient.invalidateQueries();
  };

  const send = () => {
    const message = text.trim();
    if (message && !ask.isPending) ask.mutate(message);
  };

  // Hidden during a proctored test, so it can't be used as a source of answers.
  if (location.startsWith("/mcq/take-test") || !status?.available) return null;

  if (!open) {
    return (
      <Button
        size="icon"
        className={`fixed right-4 z-40 h-12 w-12 rounded-full shadow-lg ${location.startsWith("/chat") ? "bottom-36" : "bottom-4"}`}
        onClick={() => setOpen(true)}
        aria-label="Open portal assistant"
        data-testid="button-open-assistant"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <section
      className={`fixed z-40 flex flex-col bg-card border shadow-xl ${full ? "inset-0" : "inset-x-0 bottom-0 top-16 sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[32rem] sm:w-96 sm:rounded-lg"}`}
      aria-label="Portal assistant"
      data-testid="panel-assistant"
    >
      <header className="flex items-center gap-1 border-b p-2">
        <Bot className="w-5 h-5 text-primary ml-1" />
        <h2 className="flex-1 text-sm font-semibold ml-1">Assistant</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset} aria-label="New conversation" data-testid="button-new-conversation"><Plus className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory((v) => !v)} aria-label="Conversation history" data-testid="button-assistant-history"><History className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFull((v) => !v)} aria-label={full ? "Exit full screen" : "Full screen"} data-testid="button-assistant-full">
          {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close assistant"><X className="w-4 h-4" /></Button>
      </header>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations?.length === 0 && <p className="text-sm text-muted-foreground p-2">No conversations yet</p>}
          {conversations?.map((c) => (
            <div key={c._id} className="flex items-center gap-1">
              <Button variant="ghost" className="flex-1 min-w-0 justify-start font-normal" onClick={() => openConversation.mutate(c._id)}><span className="truncate">{c.title}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove.mutate(c._id)} aria-label={`Delete ${c.title}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite" data-testid="assistant-messages">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ask how to do something, ask about your own records, or tell me what to create.</p>
              {status.suggestions.map((question) => (
                <Button key={question} variant="outline" size="sm" className="w-full h-auto py-2 justify-start text-left whitespace-normal" onClick={() => ask.mutate(question)}>{question}</Button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <div key={message._id} className={message.sender === "user" ? "flex justify-end" : ""} data-testid={`assistant-message-${message.sender}`}>
              <div className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words max-w-[90%] ${message.sender === "user" ? "bg-primary text-primary-foreground" : message.failed ? "bg-destructive/10" : "bg-muted"}`}>
                {message.content}
              </div>
              {message.sources?.map((source) => (
                <Button key={source.articleId} variant="ghost" size="sm" className="h-auto p-1 text-xs underline" onClick={() => openArticle.mutate(source.articleId)}>{source.title}</Button>
              ))}
              {message.page && (
                <Button asChild variant="outline" size="sm" className="mt-1 block w-fit h-auto py-1" data-testid="assistant-page-link">
                  <Link href={message.page.path} onClick={leaveFor}>Open {message.page.label}</Link>
                </Button>
              )}
              {message.sender === "assistant" && !message._id.startsWith("ticket-") && !message.failed && (
                <div className="flex gap-1 mt-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Helpful" aria-pressed={message.feedback?.rating === "helpful"} onClick={() => feedback.mutate({ id: message._id, body: { rating: "helpful" } })}><ThumbsUp className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Not helpful" aria-pressed={message.feedback?.rating === "not_helpful"} onClick={() => feedback.mutate({ id: message._id, body: { rating: "not_helpful" } })} data-testid="button-not-helpful"><ThumbsDown className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Report incorrect answer" onClick={() => feedback.mutate({ id: message._id, body: { rating: "not_helpful", reportedIncorrect: true } })}><Flag className="w-3 h-3" /></Button>
                </div>
              )}
            </div>
          ))}
          {ask.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Thinking</p>}
          {action && <ActionCard key={action.messageId} action={action} onDone={actionSaved} onCancel={() => setAction(null)} />}
          {offer?.existing && <p className="text-sm text-muted-foreground">Ticket {offer.existing} is already open for this conversation. <Link href="/tickets" className="underline">View tickets</Link></p>}
          {offer?.subject && (
            <div className="rounded-lg border p-3 space-y-2" data-testid="assistant-ticket-offer">
              <p className="text-sm">Would you like me to raise a support ticket for this?</p>
              <p className="text-xs text-muted-foreground break-words">{offer.subject}</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={raiseTicket.isPending} onClick={() => raiseTicket.mutate()} data-testid="button-confirm-ticket">Yes, raise a ticket</Button>
                <Button size="sm" variant="ghost" onClick={() => setOffer(null)}>No thanks</Button>
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
      )}

      {!showHistory && (
        <form className="flex items-end gap-2 border-t p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <Textarea
            rows={2}
            className="resize-none"
            placeholder="Ask, or tell me what to create"
            aria-label="Your question"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            data-testid="input-assistant-question"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || ask.isPending} aria-label="Send" data-testid="button-assistant-send"><Send className="w-4 h-4" /></Button>
        </form>
      )}

      <Dialog open={!!article} onOpenChange={(value) => { if (!value) setArticle(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{article?.title}</DialogTitle></DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{article?.body}</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
