import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2, Zap, Search, TrendingUp, AlertTriangle, Package, Clock, CreditCard, Building2, ShieldAlert, FileCheck, BadgeAlert, Users, BarChart2, Download, FileSpreadsheet, FileImage, FileText, Presentation, Library, History as HistoryIcon, Bookmark, PanelRightClose, MessageSquare, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [{ title: "Ask IntelliSource AI — KPMG IntelliSource" }],
  }),
  component: AskIntelliSource,
});

interface Artifact {
  id: string;
  type: "chart_png" | "excel" | "pptx" | "pdf" | string;
  filename: string;
  url: string;
  preview?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools_used?: string[];
  artifacts?: Artifact[];
  loading?: boolean;
}

interface PromptLibraryItem {
  id: number;
  name: string;
  category: string;
  prompt_text: string;
  use_count: number;
}

interface ChatSessionSummary {
  session_id: string;
  title: string;
  updated_at: string;
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Spend Summary",
    text: "What is the total procurement spend this month broken down by company code and CAPEX vs OPEX? Show top spending categories.",
  },
  {
    icon: AlertTriangle,
    label: "Anomaly Risk Report",
    text: "Give me a full anomaly risk report — split POs, retro POs, price variances, no-GRN cases, and deleted-after-GRN. Include PO numbers.",
  },
  {
    icon: Users,
    label: "Top Vendors by Spend",
    text: "Who are the top 10 vendors by spend this year? Show their PO count, total value, and payment status.",
  },
  {
    icon: Package,
    label: "P2P Cycle Times",
    text: "What is the average cycle time at each P2P stage: PR to PO, PO to GRN, GRN to Invoice, Invoice to Payment? Which stage has the most delays?",
  },
  {
    icon: Clock,
    label: "PR to PO Backlog",
    text: "Show all open purchase requisitions that have not yet been converted to a PO. How many days have they been pending? Which departments have the highest backlog?",
  },
  {
    icon: CreditCard,
    label: "Overdue Payments",
    text: "Which vendors have invoices pending payment beyond 30 days? Show the invoice amounts, due dates, and total overdue value by vendor.",
  },
  {
    icon: Building2,
    label: "Budget vs Actual",
    text: "Compare actual CAPEX and OPEX spend against the defined budget for each profit center. Flag any profit centers that are over budget.",
  },
  {
    icon: ShieldAlert,
    label: "Maverick Buying",
    text: "Show all maverick buying incidents — POs raised without a valid purchase requisition. Which departments and vendors are involved and what is the total value?",
  },
  {
    icon: FileCheck,
    label: "GRN Pending POs",
    text: "Show all active POs where goods receipt (GRN) has not yet been posted. How long have these POs been open and what is the total open value?",
  },
  {
    icon: BadgeAlert,
    label: "MSME Compliance",
    text: "Which MSME-registered vendors have payment delays beyond 45 days? Are we compliant with MSMED Act payment timelines? Show total overdue amount.",
  },
];

function ToolBadge({ name }: { name: string }) {
  const labels: Record<string, string> = {
    query_database: "SQL Query",
    get_metric: "Metric Lookup",
    get_kpis: "KPI Lookup",
    find_document: "Document Lookup",
    get_anomalies: "Anomaly Scan",
    get_vendor_info: "Vendor Data",
    get_p2p_stage_summary: "P2P Summary",
    analyze_data: "Data Analysis",
    create_visual: "Chart",
    create_report: "Report",
    start_report: "Report Draft",
    add_table_section: "Report Table",
    add_chart_section: "Report Chart",
    add_narrative_section: "Report Text",
    finalize_report: "Report Export",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
      <Zap className="h-2 w-2" />
      {labels[name] ?? name}
    </span>
  );
}

const ARTIFACT_META: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  chart_png: { icon: FileImage, label: "Chart", color: "text-accent" },
  excel: { icon: FileSpreadsheet, label: "Excel Workbook", color: "text-success" },
  pptx: { icon: Presentation, label: "PowerPoint Deck", color: "text-warning" },
  pdf: { icon: FileText, label: "PDF Report", color: "text-danger" },
};

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const meta = ARTIFACT_META[artifact.type] ?? { icon: FileText, label: "File", color: "text-muted-foreground" };
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-[320px]">
      {artifact.type === "chart_png" && (
        // live turn has an inline base64 preview; resumed-from-history charts
        // only carry the url (preview is not persisted) — both render inline
        <img src={artifact.preview || artifact.url} alt={artifact.filename} className="w-full border-b border-border" />
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-foreground truncate">{artifact.filename}</div>
          <div className="text-[9px] text-muted-foreground">{meta.label}</div>
        </div>
        <a
          href={artifact.url}
          download={artifact.filename}
          className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
        >
          <Download className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onSaveAsPrompt }: { msg: Message; onSaveAsPrompt?: (text: string) => void }) {
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
    <div className={cn("flex items-start gap-3 group", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary text-white" : "bg-primary/15",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className={cn("max-w-[78%] space-y-1.5", isUser && "items-end flex flex-col")}>
        <div className={cn("flex items-start gap-1.5", isUser && "flex-row-reverse")}>
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
        {isUser && onSaveAsPrompt && (
          <button
            onClick={() => onSaveAsPrompt(msg.content)}
            title="Save as reusable prompt"
            className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          >
            <Bookmark className="h-3 w-3" />
          </button>
        )}
        </div>
        {msg.tools_used && msg.tools_used.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.tools_used.map((t) => (
              <ToolBadge key={t} name={t} />
            ))}
          </div>
        )}
        {msg.artifacts && msg.artifacts.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1">
            {msg.artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
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

// ── Side panel: Prompt Library ──────────────────────────────────────────────────

function PromptLibraryPanel({ onRun }: { onRun: (text: string) => void }) {
  const [prompts, setPrompts] = useState<PromptLibraryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<PromptLibraryItem[]>(
        activeCategory === "All" ? "/prompt-library" : `/prompt-library?category=${encodeURIComponent(activeCategory)}`,
      ),
      apiFetch<string[]>("/prompt-library/categories"),
    ])
      .then(([p, c]) => {
        setPrompts(p);
        setCategories(c);
      })
      .catch(() => toast.error("Couldn't load prompt library"))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => {
    load();
  }, [load]);

  const runPrompt = async (p: PromptLibraryItem) => {
    try {
      await apiFetch(`/prompt-library/${p.id}/use`, { method: "POST" });
    } catch {
      // non-fatal — still run the prompt even if the use-count ping fails
    }
    onRun(p.prompt_text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 overflow-x-auto shrink-0">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
              activeCategory === c
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {loading ? (
          <div className="text-[11px] text-muted-foreground text-center py-6">Loading…</div>
        ) : prompts.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-6">No prompts in this category.</div>
        ) : (
          prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => runPrompt(p)}
              className="w-full text-left p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground truncate">{p.name}</span>
                {p.use_count > 0 && (
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">{p.use_count}×</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.prompt_text}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Side panel: Conversation History ────────────────────────────────────────────

function HistoryPanel({ onResume }: { onResume: (sessionId: string) => void }) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<ChatSessionSummary[]>("/chat/sessions")
      .then(setSessions)
      .catch(() => toast.error("Couldn't load conversation history"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/chat/sessions/${sid}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.session_id !== sid));
    } catch {
      toast.error("Couldn't delete conversation");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
      {loading ? (
        <div className="text-[11px] text-muted-foreground text-center py-6">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-[11px] text-muted-foreground text-center py-6">No saved conversations yet.</div>
      ) : (
        sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onResume(s.session_id)}
            className="w-full flex items-center gap-2 text-left p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-foreground truncate flex-1">{s.title}</span>
            <span
              onClick={(e) => remove(e, s.session_id)}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))
      )}
    </div>
  );
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
  const [panelTab, setPanelTab] = useState<"library" | "history" | null>(null);
  const sessionId = useRef(getOrCreateSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveAsPrompt = useCallback(async (text: string) => {
    try {
      await apiFetch("/prompt-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: text.slice(0, 60), category: "General", prompt_text: text }),
      });
      toast.success("Saved to Prompt Library");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't save prompt: ${msg}`);
    }
  }, []);

  const resumeSession = useCallback(async (sid: string) => {
    try {
      const msgs = await apiFetch<{ role: "user" | "assistant"; content: string; tools_used: string[]; artifacts?: Artifact[] }[]>(
        `/chat/sessions/${sid}/messages`,
      );
      sessionId.current = sid;
      try { localStorage.setItem("intellisource_chat_session", sid); } catch {}
      setMessages(
        msgs.length
          ? msgs.map((m, i) => ({ id: `${sid}-${i}`, role: m.role, content: m.content, tools_used: m.tools_used, artifacts: m.artifacts }))
          : [{ id: "welcome", role: "assistant", content: "Conversation resumed — ask a follow-up." }],
      );
      setPanelTab(null);
    } catch {
      toast.error("Couldn't load that conversation");
    }
  }, []);

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
        const data = await apiFetch<{ reply: string; tools_used: string[]; artifacts?: Artifact[] }>("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, session_id: sessionId.current }),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: loadingId, role: "assistant", content: data.reply, tools_used: data.tools_used, artifacts: data.artifacts }
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
    apiFetch(`/chat/session/${sessionId.current}`, { method: "DELETE" }).catch(() => {});
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
          showExport={false}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPanelTab((t) => (t === "library" ? null : "library"))}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] transition-all",
                  panelTab === "library"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-accent/40",
                )}
              >
                <Library className="h-3.5 w-3.5" /> Prompt Library
              </button>
              <button
                onClick={() => setPanelTab((t) => (t === "history" ? null : "history"))}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] transition-all",
                  panelTab === "history"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-accent/40",
                )}
              >
                <HistoryIcon className="h-3.5 w-3.5" /> History
              </button>
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-[12px] text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear chat
              </button>
            </div>
          }
        />

        <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onSaveAsPrompt={saveAsPrompt} />
          ))}

          {/* Quick prompts — show only when just the welcome message is present */}
          {messages.length === 1 && (
            <div className="pt-2 space-y-2">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium px-1">Top project questions</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.label}
                      onClick={() => send(p.text)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
                    >
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors mt-0.5">
                        <Icon className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground/40 font-mono">#{idx + 1}</span>
                          <div className="text-[12px] font-medium text-foreground">{p.label}</div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.text}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
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

        {/* Side panel — Prompt Library / History */}
        {panelTab && (
          <div className="w-72 shrink-0 border-l border-border bg-surface flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                {panelTab === "library" ? "Prompt Library" : "History"}
              </span>
              <button
                onClick={() => setPanelTab(null)}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>
            {panelTab === "library" ? (
              <PromptLibraryPanel onRun={(text) => { setPanelTab(null); send(text); }} />
            ) : (
              <HistoryPanel onResume={resumeSession} />
            )}
          </div>
        )}
        </div>
      </div>
    </AppShell>
  );
}
