import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Crown,
  Users,
  Activity,
  Workflow,
  BookOpen,
  ListTodo,
  UserCog,
  History,
  Settings,
  Upload,
  User as UserIcon,
  ShieldAlert,
  AlertTriangle,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { useApp, roleInitials } from "@/context/AppContext";
import { fetchAnomalies } from "@/api/queries";
import { apiFetch } from "@/api/client";
import type { AnomalyCount } from "@/api/types";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const dashboards: NavItem[] = [
  { label: "Procurement", to: "/dashboard", icon: LayoutDashboard },
  { label: "Financial", to: "/financial", icon: Wallet },
  { label: "Leadership", to: "/leadership", icon: Crown },
  { label: "Vendor Performance", to: "/vendors", icon: Users },
  { label: "Utilization", to: "/utilization", icon: Activity },
];

const operations: NavItem[] = [
  { label: "Ask IntelliSource", to: "/ask", icon: Sparkles },
  { label: "P2P Lifecycle", to: "/p2p", icon: Workflow },
  { label: "Vendor Repository", to: "/vendor-repo", icon: BookOpen },
  { label: "Log Action", to: "/actions", icon: ListTodo },
  { label: "Data Upload", to: "/upload", icon: Upload },
  { label: "Activity History", to: "/history", icon: History },
];

const admin: NavItem[] = [
  { label: "User Management", to: "/admin/users", icon: UserCog, adminOnly: true },
  { label: "Audit Trail", to: "/admin/audit", icon: History, adminOnly: true },
  { label: "Settings", to: "/admin/settings", icon: Settings, adminOnly: true },
];

function Section({ title, items, isAdmin }: { title: string; items: NavItem[]; isAdmin?: boolean }) {
  const location = useLocation();
  const filtered = items.filter((i) => !i.adminOnly || isAdmin);
  if (!filtered.length) return null;
  return (
    <div className="mb-5">
      <div className="px-4 mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-sidebar-foreground/30">
        {title}
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {filtered.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all duration-200",
                active && "text-sidebar-foreground font-medium",
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-sidebar-accent rounded-md"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className="h-[15px] w-[15px] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity relative z-10" />
              <span className="truncate relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

interface SessionEvent {
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

function SidebarAlerts() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: anomalies = [] } = useQuery<AnomalyCount[]>({
    queryKey: ["anomalies"],
    queryFn: fetchAnomalies,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: sessions = [] } = useQuery<SessionEvent[]>({
    queryKey: ["auth-sessions"],
    queryFn: () => apiFetch<SessionEvent[]>("/auth/sessions?limit=5"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const highCount   = anomalies.filter(a => a.severity === "HIGH").length;
  const medCount    = anomalies.filter(a => a.severity === "MEDIUM").length;
  const totalAlerts = anomalies.length;
  const sorted      = [...anomalies].sort((a, b) => {
    const r: Record<string,number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (r[a.severity] ?? 3) - (r[b.severity] ?? 3);
  });

  function sessionIcon(action: string) {
    if (action === "LOGIN")  return <LogIn  className="h-2.5 w-2.5 text-success" />;
    if (action === "LOGOUT") return <LogOut className="h-2.5 w-2.5 text-danger" />;
    return <RefreshCw className="h-2.5 w-2.5 text-warning" />;
  }

  return (
    <div className="mx-2 mb-2 rounded-md border border-sidebar-border/60 overflow-hidden">
      {/* Clickable header — toggles expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-3 py-1.5 bg-sidebar-accent/30 border-b border-sidebar-border/40 flex items-center justify-between hover:bg-sidebar-accent/50 transition-colors"
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40">Alert Center</span>
        <div className="flex items-center gap-1">
          {totalAlerts > 0 && (
            <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
              highCount > 0 ? "bg-danger/20 text-danger" :
              medCount > 0  ? "bg-warning/20 text-warning" : "bg-accent/20 text-accent"
            }`}>
              {totalAlerts}
            </span>
          )}
          <span className="text-[8px] text-sidebar-foreground/30">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Collapsed: compact summary */}
      {!expanded && (
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {totalAlerts === 0 ? (
              <span className="text-[10px] text-success flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                All clear
              </span>
            ) : (
              <>
                {highCount > 0 && <span className="flex items-center gap-0.5 text-[10px] text-danger"><ShieldAlert className="h-3 w-3" />{highCount}</span>}
                {medCount > 0  && <span className="flex items-center gap-0.5 text-[10px] text-warning"><AlertTriangle className="h-3 w-3" />{medCount}</span>}
              </>
            )}
          </div>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="text-[8px] text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
          >
            View →
          </button>
        </div>
      )}

      {/* Expanded: full detail */}
      {expanded && (
        <>
          {/* Anomaly list */}
          <div className="border-b border-sidebar-border/30">
            <div className="px-3 pt-2 pb-1 text-[9px] text-sidebar-foreground/35 font-semibold uppercase tracking-wide">Anomalies</div>
            {sorted.length === 0 ? (
              <div className="px-3 pb-2 text-[10px] text-success flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> All clear
              </div>
            ) : (
              <div className="max-h-[130px] overflow-y-auto">
                {sorted.slice(0, 6).map(a => (
                  <div key={a.anomaly_code} className="flex items-center justify-between px-3 py-1 hover:bg-sidebar-accent/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.severity === "HIGH"   ? <ShieldAlert className="h-2.5 w-2.5 text-danger shrink-0" /> :
                       a.severity === "MEDIUM" ? <AlertTriangle className="h-2.5 w-2.5 text-warning shrink-0" /> :
                                                 <span className="h-2.5 w-2.5 shrink-0" />}
                      <span className="text-[10px] text-sidebar-foreground/70 truncate">
                        {a.anomaly_code.replace(/_/g," ")}
                      </span>
                    </div>
                    <span className={`text-[8px] px-1 rounded shrink-0 ml-1 ${
                      a.severity === "HIGH"   ? "text-danger"  :
                      a.severity === "MEDIUM" ? "text-warning" : "text-sidebar-foreground/40"
                    }`}>{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent sessions */}
          <div>
            <div className="px-3 pt-2 pb-1 text-[9px] text-sidebar-foreground/35 font-semibold uppercase tracking-wide">User Activity</div>
            {sessions.length === 0 ? (
              <div className="px-3 pb-2 text-[10px] text-sidebar-foreground/30">No activity yet</div>
            ) : (
              <div className="max-h-[100px] overflow-y-auto">
                {sessions.slice(0, 4).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1 hover:bg-sidebar-accent/20">
                    <div className="shrink-0">{sessionIcon(s.action)}</div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-sidebar-foreground/70 truncate block">{s.user_name}</span>
                      <span className="text-[9px] text-sidebar-foreground/35">{s.action.replace("_"," ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer link */}
          <div className="px-3 py-1.5 border-t border-sidebar-border/30 bg-sidebar-accent/20">
            <button
              onClick={() => { setExpanded(false); navigate({ to: "/dashboard" }); }}
              className="text-[9px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors w-full text-center"
            >
              View full Alert Center →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarProfileButton() {
  const { user, role } = useApp();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/profile" })}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
    >
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
        style={{ background: user.avatarColor }}
      >
        {roleInitials(user.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-sidebar-foreground truncate">{user.name}</div>
        <div className="text-[10px] text-sidebar-foreground/40 truncate">{role}</div>
      </div>
      <UserIcon className="h-3.5 w-3.5 text-sidebar-foreground/30 shrink-0" />
    </button>
  );
}

export function Sidebar() {
  const { role } = useApp();
  const isAdmin = role === "Admin";

  return (
    <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="h-16 px-4 flex items-center gap-2.5 border-b border-sidebar-border">
        <Logo variant="white" size={20} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-sidebar-foreground tracking-tight font-heading leading-tight">IntelliSource</div>
          <div className="text-[9px] text-sidebar-foreground/45 tracking-wide leading-tight">Procurement Optimization</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <Section title="Dashboards" items={dashboards} />
        <Section title="Operations" items={operations} />
        <Section title="Admin" items={admin} isAdmin={isAdmin} />
      </div>

      <div className="border-t border-sidebar-border">
        <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-sidebar-border/50">
          <Logo variant="white" size={18} />
          <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-wide">KPMG IntelliSource</span>
        </div>
        <div className="pt-2">
          <SidebarAlerts />
        </div>
        <div className="px-2 pb-2">
          <SidebarProfileButton />
        </div>
      </div>
    </aside>
  );
}
