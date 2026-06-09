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
} from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "./Logo";
import { useApp, roleInitials } from "@/context/AppContext";
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
  { label: "Action Items", to: "/actions", icon: ListTodo },
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
        {filtered.map((item, i) => {
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
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-sidebar-border">
        <Logo variant="white" size={24} />
        <span className="text-[15px] font-semibold text-sidebar-foreground tracking-tight font-heading">IntelliSource</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <Section title="Dashboards" items={dashboards} />
        <Section title="Operations" items={operations} />
        <Section title="Admin" items={admin} isAdmin={isAdmin} />
      </div>

      <div className="border-t border-sidebar-border px-2 py-2">
        <SidebarProfileButton />
      </div>
    </aside>
  );
}
