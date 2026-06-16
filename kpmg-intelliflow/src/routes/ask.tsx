import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2, Zap, Search, TrendingUp, AlertTriangle, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [{ title: "Ask IntelliSource AI — KPMG IntelliSource" }],
  }),
  component: AskIntelliSource,
});

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools_used?: string[];
  loading?: boolean;
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Procurement summary", text: "Give me a summary of this month's procurement activity and key KPIs." },
  { icon: Search, label: "Top vendors by spend", text: "Which vendors have the highest spend? Show top 10." },
  { icon: AlertTriangle, label: "Anomalies overview", text: "What are all the procurement anomalies detected and their risk levels?" },
  { icon: Package, label: "P2P cycle times", text: "What is the average cycle time at each P2P stage (PR → PO → GRN → Invoice → Payment)?" },
];

function ToolBadge({ name }: { name: string }) {
  const labels: Record<string, string> = {
    query_database: "SQL Query",
    get_kpis: "KPI Lookup",
    find_document: "Document Lookup",
    get_anomalies: "Anomaly Scan",
    get_vendor_info: "Vendor Data",
    get_p2p_stage_summary: "P2P Summary",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
      <Zap className="h-2 w-2" />
      {labels[name] ?? name}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (msg.loading) {
    return (
      <div className="flex items-start gap-3">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Analysing your question…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary text-white" : "bg-primary/15",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className={cn("max-w-[78%] space-y-1.5", isUser && "items-end flex flex-col")}>
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-white rounded-tr-sm"
              : "bg-card border border-border text-foreground rounded-tl-sm",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <MarkdownContent content={msg.content} />
          )}
        </div>
        {msg.tools_used && msg.tools_used.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.tools_used.map((t) => (
              <ToolBadge key={t} name={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-semibold text-foreground mt-2 mb-1 text-[13px]">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-foreground mt-3 mb-1 text-sm">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-foreground mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-3 list-disc text-[13px] leading-snug">
          <InlineMarkdown text={line.slice(2)} />
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, "");
      elements.push(
        <li key={i} className="ml-3 list-decimal text-[13px] leading-snug">
          <InlineMarkdown text={text} />
        </li>,
      );
    } else if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-muted rounded-md p-3 text-[11px] overflow-x-auto font-mono my-1 border border-border">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
    } else if (line.startsWith("|")) {
      // Simple markdown table
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={i} lines={tableLines} />);
      continue;
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed">
          <InlineMarkdown text={line} />
        </p>,
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="bg-muted px-1 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.match(/^\|[-: |]+\|$/))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  if (!rows.length) return null;
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto my-2">
      <table className="text-[11px] border-collapse w-full">
        <thead>
          <tr className="bg-muted">
            {header.map((h, i) => (
              <th key={i} className="border border-border px-2 py-1 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/30"}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-2 py-1 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function getOrCreateSessionId(): string {
  try {
    let sid = localStorage.getItem("intellisource_chat_session");
    if (!sid) {
      sid = genId() + genId();
      localStorage.setItem("intellisource_chat_session", sid);
    }
    return sid;
  } catch {
    return genId();
  }
}

function AskIntelliSource() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm **IntelliSource AI** — your procurement analytics assistant.\n\nI have live access to your P2P database and can answer questions about POs, vendors, KPIs, anomalies, and more.\n\nTry one of the quick prompts below, or ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(getOrCreateSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const userText = text.trim();
      if (!userText || loading) return;
      setInput("");

      const userId = genId();
      const loadingId = genId();

      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: userText },
        { id: loadingId, role: "assistant", content: "", loading: true },
      ]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, session_id: sessionId.current }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: loadingId, role: "assistant", content: data.reply, tools_used: data.tools_used }
              : m,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: loadingId, role: "assistant", content: `Sorry, something went wrong: ${msg}` }
              : m,
          ),
        );
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading],
  );

  const clearChat = () => {
    // clear server-side session
    fetch(`/api/chat/session/${sessionId.current}`, { method: "DELETE" }).catch(() => {});
    sessionId.current = genId() + genId();
    try { localStorage.setItem("intellisource_chat_session", sessionId.current); } catch {}
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. Ask me anything about your procurement data.",
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-52px)] max-h-[calc(100vh-52px)]">
        <PageHeader
          title="Ask IntelliSource"
          subtitle="AI-powered procurement analytics — ask anything about your P2P data"
        >
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-[12px] text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear chat
          </button>
        </PageHeader>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Quick prompts — show only when just the welcome message is present */}
          {messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {QUICK_PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.label}
                    onClick={() => send(p.text)}
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
                  >
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-foreground">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.text}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-surface px-6 py-3">
          <div className="flex items-end gap-3 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder='Ask anything — e.g. "Tell me about PO 2000001004 and its KPIs"'
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none min-h-[28px] max-h-[120px] overflow-y-auto leading-relaxed py-0.5 disabled:opacity-50"
              style={{ height: "28px" }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/40 text-center mt-1.5">
            IntelliSource AI queries live data · Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </AppShell>
  );
}
