import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Crown,
  Users,
  Activity,
  Workflow,
  BookOpen,
  ShieldCheck,
  ListTodo,
  UserCog,
  History,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { useApp } from "@/context/AppContext";
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
  { label: "P2P Lifecycle", to: "/p2p", icon: Workflow },
  { label: "Vendor Repository", to: "/vendor-repo", icon: BookOpen },
  { label: "Compliance Center", to: "/compliance", icon: ShieldCheck },
  { label: "Action Management", to: "/actions", icon: ListTodo },
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
    <div className="mb-6">
      <div className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {title}
      </div>
      <nav className="flex flex-col">
        {filtered.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-[13px] text-white/80 hover:bg-sidebar-accent hover:text-white transition-colors border-l-[3px] border-transparent",
                active && "bg-sidebar-accent text-white border-accent font-semibold",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { role } = useApp();
  const isAdmin = role === "Admin";

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-sidebar-border">
        <Logo variant="white" size={28} />
        <div className="h-6 w-px bg-white/20" />
        <span className="font-serif italic text-white text-[15px] tracking-tight">IntelliSource</span>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        <Section title="Dashboards" items={dashboards} />
        <Section title="Operations" items={operations} />
        <Section title="Admin" items={admin} isAdmin={isAdmin} />
      </div>

      <div className="border-t border-sidebar-border p-4 flex items-center justify-between">
        <a
          href="#"
          className="flex items-center gap-2 text-[12px] text-white/70 hover:text-white"
        >
          <HelpCircle className="h-4 w-4" />
          Help & Support
        </a>
        <Logo variant="white" size={22} />
      </div>
    </aside>
  );
}
