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
  { label: "Action Items", to: "/actions", icon: ListTodo },
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
      <div className="px-4 mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">
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
                "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150",
                active && "bg-sidebar-accent text-sidebar-foreground font-medium",
              )}
            >
              <Icon className="h-[15px] w-[15px] shrink-0 opacity-70" />
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
    <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-sidebar-border">
        <Logo variant="white" size={24} />
        <span className="text-[14px] font-semibold text-sidebar-foreground tracking-tight">IntelliSource</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <Section title="Dashboards" items={dashboards} />
        <Section title="Operations" items={operations} />
        <Section title="Admin" items={admin} isAdmin={isAdmin} />
      </div>

      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="text-[10px] text-sidebar-foreground/30">© 2024 KPMG</div>
      </div>
    </aside>
  );
}
