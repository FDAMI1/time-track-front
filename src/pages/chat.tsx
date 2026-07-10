import { apiFetch, safeJson } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Send,
  MessageCircle,
  Users,
  Pencil,
  Trash2,
  Check,
  X,
  ThumbsUp,
  Heart,
  Star,
  Smile,
  Search,
  ArrowLeft,
} from "lucide-react";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const reactionIcons = [
  { emoji: "thumbsup", Icon: ThumbsUp, label: "Thumbs Up" },
  { emoji: "heart", Icon: Heart, label: "Heart" },
  { emoji: "star", Icon: Star, label: "Star" },
  { emoji: "smile", Icon: Smile, label: "Smile" },
];

export default function ChatPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [showConvList, setShowConvList] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [convType, setConvType] = useState<string>("private");
  const [convName, setConvName] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [searchConv, setSearchConv] = useState("");
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const res = await apiFetch("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiFetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["/api/chat/conversations", selectedConversation?._id, "messages"],
    queryFn: async () => {
      if (!selectedConversation?._id) return [];
      const res = await apiFetch(
        `/api/chat/conversations/${selectedConversation._id}/messages?page=1&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      return safeJson(res);
    },
    enabled: !!selectedConversation?._id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = useMutation({
    mutationFn: async () => {
      const body: any = { type: convType, participantIds: selectedParticipants };
      if (convType === "group" && convName) body.name = convName;
      const res = await apiFetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create conversation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setCreateOpen(false);
      setConvType("private");
      setConvName("");
      setSelectedParticipants([]);
      setSelectedConversation(data.conversation || data);
      toast({ title: "Conversation created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiFetch(
        `/api/chat/conversations/${selectedConversation._id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) throw new Error("Failed to send message");
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation?._id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessageInput("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const editMessage = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiFetch(`/api/chat/messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to edit message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation?._id, "messages"],
      });
      setEditingMessageId(null);
      setEditContent("");
    },
    onError: () => {
      toast({ title: "Failed to edit message", variant: "destructive" });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/chat/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation?._id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to delete message", variant: "destructive" });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await apiFetch(`/api/chat/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("Failed to toggle reaction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation?._id, "messages"],
      });
      setShowReactionsFor(null);
    },
  });

  const handleSend = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedConversation) return;
    sendMessage.mutate(trimmed);
  };

  const getConversationName = (conv: any) => {
    if (conv.name) return conv.name;
    if (conv.type === "private" && conv.participants) {
      const other = conv.participants.find(
        (p: any) => (typeof p === "string" ? p : p._id) !== user?._id
      );
      if (other && typeof other === "object") {
        return `${other.firstName} ${other.lastName}`;
      }
    }
    return "Conversation";
  };

  const getConversationInitials = (conv: any) => {
    const name = getConversationName(conv);
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const getSenderName = (msg: any) => {
    const sender = msg.senderId || msg.sender;
    if (sender && typeof sender === "object") {
      return `${sender.firstName} ${sender.lastName}`;
    }
    return "Unknown";
  };

  const getSenderId = (msg: any) => {
    const sender = msg.senderId || msg.sender;
    if (sender && typeof sender === "object") return sender._id;
    return sender;
  };

  const isOwnMessage = (msg: any) => getSenderId(msg) === user?._id;

  const messageList = Array.isArray(messages?.messages) ? messages.messages : Array.isArray(messages) ? messages : [];

  const filteredConversations = (conversations || []).filter((c: any) => {
    if (!searchConv) return true;
    return getConversationName(c).toLowerCase().includes(searchConv.toLowerCase());
  });

  const otherUsers = (users || []).filter((u: any) => u._id !== user?._id);

  return (
    <div className="flex h-full overflow-hidden" data-testid="chat-page">
      <div className={`border-r flex flex-col shrink-0 w-full md:w-80 ${!showConvList ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-lg" data-testid="text-chat-title">Chat</h2>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-new-conversation">
                  <Plus />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={convType} onValueChange={setConvType}>
                      <SelectTrigger data-testid="select-conv-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {convType === "group" && (
                    <div>
                      <Label>Group Name</Label>
                      <Input
                        value={convName}
                        onChange={(e) => setConvName(e.target.value)}
                        placeholder="Enter group name"
                        data-testid="input-conv-name"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Participants</Label>
                    <ScrollArea className="h-48 border rounded-md p-2 mt-1">
                      {otherUsers.map((u: any) => (
                        <label
                          key={u._id}
                          className="flex items-center gap-2 py-1.5 cursor-pointer"
                          data-testid={`label-participant-${u._id}`}
                        >
                          <Checkbox
                            checked={selectedParticipants.includes(u._id)}
                            onCheckedChange={(checked) => {
                              if (convType === "private") {
                                setSelectedParticipants(checked ? [u._id] : []);
                              } else {
                                setSelectedParticipants((prev) =>
                                  checked
                                    ? [...prev, u._id]
                                    : prev.filter((id) => id !== u._id)
                                );
                              }
                            }}
                            data-testid={`checkbox-participant-${u._id}`}
                          />
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {u.firstName} {u.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {u.role}
                          </span>
                        </label>
                      ))}
                    </ScrollArea>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      selectedParticipants.length === 0 ||
                      (convType === "group" && !convName.trim()) ||
                      createConversation.isPending
                    }
                    onClick={() => createConversation.mutate()}
                    data-testid="button-create-conversation"
                  >
                    {createConversation.isPending ? "Creating..." : "Create Conversation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-8"
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {convsLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="p-1">
              {filteredConversations.map((conv: any) => {
                const isSelected = selectedConversation?._id === conv._id;
                return (
                  <button
                    key={conv._id}
                    className={`w-full text-left p-3 rounded-md flex items-center gap-3 hover-elevate ${
                      isSelected ? "bg-accent" : ""
                    }`}
                    onClick={() => { setSelectedConversation(conv); setShowConvList(false); }}
                    data-testid={`button-conversation-${conv._id}`}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {conv.type === "group" ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          getConversationInitials(conv)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate" data-testid={`text-conv-name-${conv._id}`}>
                          {getConversationName(conv)}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-conv-time-${conv._id}`}>
                            {formatTime(conv.lastMessageAt || conv.updatedAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage?.content || (conv.type === "group" ? "Group chat" : "Start chatting")}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs shrink-0" data-testid={`badge-unread-${conv._id}`}>
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${showConvList ? "hidden md:flex" : "flex"}`}>
        {!selectedConversation ? (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium" data-testid="text-no-conversation">
                Select a conversation to start messaging
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 md:hidden shrink-0"
                onClick={() => setShowConvList(true)}
                data-testid="button-back-to-convs"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {selectedConversation.type === "group" ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    getConversationInitials(selectedConversation)
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm" data-testid="text-selected-conv-name">
                  {getConversationName(selectedConversation)}
                </p>
                {selectedConversation.type === "group" && selectedConversation.participants && (
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.participants.length} members
                  </p>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {msgsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-3/4" />
                  ))}
                </div>
              ) : messageList.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-messages">
                    No messages yet. Say hello!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messageList.map((msg: any) => {
                    const own = isOwnMessage(msg);
                    const isEditing = editingMessageId === msg._id;
                    return (
                      <div
                        key={msg._id}
                        className={`flex ${own ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg._id}`}
                      >
                        <div
                          className={`max-w-[70%] group ${
                            own ? "items-end" : "items-start"
                          }`}
                        >
                          {!own && (
                            <p className="text-xs text-muted-foreground mb-0.5 px-1" data-testid={`text-sender-${msg._id}`}>
                              {getSenderName(msg)}
                            </p>
                          )}
                          <div
                            className={`rounded-md p-2.5 ${
                              own
                                ? "bg-black text-white"
                                : "bg-white text-black border"
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="h-7 text-sm bg-background text-foreground"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      editMessage.mutate({ id: msg._id, content: editContent });
                                    }
                                    if (e.key === "Escape") {
                                      setEditingMessageId(null);
                                    }
                                  }}
                                  data-testid={`input-edit-message-${msg._id}`}
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    editMessage.mutate({ id: msg._id, content: editContent })
                                  }
                                  disabled={editMessage.isPending}
                                  data-testid={`button-save-edit-${msg._id}`}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingMessageId(null)}
                                  data-testid={`button-cancel-edit-${msg._id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-content-${msg._id}`}>
                                {msg.content}
                                {(msg.isEdited || msg.edited) && (
                                  <span className="text-xs opacity-70 ml-1">(edited)</span>
                                )}
                              </p>
                            )}
                          </div>

                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex gap-1 mt-0.5 px-1 flex-wrap">
                              {msg.reactions.map((r: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-muted rounded-md px-1.5 py-0.5 flex items-center gap-0.5 cursor-pointer"
                                  onClick={() =>
                                    toggleReaction.mutate({
                                      messageId: msg._id,
                                      emoji: r.emoji,
                                    })
                                  }
                                  data-testid={`reaction-${msg._id}-${r.emoji}`}
                                >
                                  {reactionIcons.find((ri) => ri.emoji === r.emoji)
                                    ? (() => {
                                        const ri = reactionIcons.find((ri) => ri.emoji === r.emoji)!;
                                        return <ri.Icon className="w-3 h-3" />;
                                      })()
                                    : r.emoji}
                                  {r.count > 1 && <span>{r.count}</span>}
                                  {r.users?.length > 1 && !r.count && <span>{r.users.length}</span>}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-1 mt-0.5 px-1">
                            <span className="text-xs text-muted-foreground" data-testid={`text-message-time-${msg._id}`}>
                              {formatTime(msg.createdAt || msg.timestamp)}
                            </span>

                            <div
                              className={`flex items-center gap-0.5 ml-1 invisible group-hover:visible ${
                                showReactionsFor === msg._id ? "!visible" : ""
                              }`}
                            >
                              {showReactionsFor === msg._id ? (
                                <div className="flex items-center gap-0.5 bg-background border rounded-md p-0.5">
                                  {reactionIcons.map(({ emoji, Icon, label }) => (
                                    <Button
                                      key={emoji}
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        toggleReaction.mutate({ messageId: msg._id, emoji })
                                      }
                                      data-testid={`button-react-${emoji}-${msg._id}`}
                                      title={label}
                                    >
                                      <Icon className="w-3 h-3" />
                                    </Button>
                                  ))}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => setShowReactionsFor(null)}
                                    data-testid={`button-close-reactions-${msg._id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setShowReactionsFor(msg._id)}
                                  data-testid={`button-show-reactions-${msg._id}`}
                                >
                                  <Smile className="w-3 h-3" />
                                </Button>
                              )}
                              {own && !isEditing && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditingMessageId(msg._id);
                                      setEditContent(msg.content);
                                    }}
                                    data-testid={`button-edit-message-${msg._id}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => {
                                      if (confirm("Delete this message?")) {
                                        deleteMessage.mutate(msg._id);
                                      }
                                    }}
                                    data-testid={`button-delete-message-${msg._id}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim() || sendMessage.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}