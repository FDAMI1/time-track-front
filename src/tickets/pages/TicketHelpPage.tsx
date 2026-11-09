import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useMcqApi } from "@/mcq/lib/api";

interface Article {
  _id: string;
  title: string;
  category?: string;
  body?: string;
}

// The support portal's help section: the same articles the assistant answers from.
export default function TicketHelpPage() {
  const api = useMcqApi();
  const [openId, setOpenId] = useState("");
  const { data, isError } = useQuery({ queryKey: ["/api/assistant/articles"], queryFn: () => api.get<Article[]>("/api/assistant/articles"), retry: false });
  const { data: article } = useQuery({
    queryKey: ["/api/assistant/articles", openId],
    queryFn: () => api.get<Article>(`/api/assistant/articles/${openId}`),
    enabled: !!openId,
  });

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Tickets</Link>
      <h1 className="page-title">Help Articles</h1>
      {openId && article ? (
        <Card data-testid="help-article">
          <CardContent className="p-4 space-y-2">
            <button type="button" className="text-sm text-primary underline" onClick={() => setOpenId("")}>All articles</button>
            <h2 className="font-medium break-words">{article.title}</h2>
            <p className="text-sm whitespace-pre-wrap break-words">{article.body}</p>
          </CardContent>
        </Card>
      ) : (isError || data?.length === 0) ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-articles">No help articles yet. Use "Report an issue" and the support team will help.</p>
      ) : (
        <ul className="space-y-2">
          {data?.map((a) => (
            <li key={a._id}>
              <button type="button" className="w-full rounded-lg border bg-card p-3 text-left hover:bg-accent" onClick={() => setOpenId(a._id)}>
                <span className="block font-medium break-words">{a.title}</span>
                {a.category && <span className="text-xs text-muted-foreground">{a.category}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
