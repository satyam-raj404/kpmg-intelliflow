import { useState } from "react";
import { Search, Bell, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useApp, ROLES, roleInitials } from "@/context/AppContext";
import { notifications } from "@/data/mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PERIODS = ["Q1 FY24", "Q2 FY24", "Q3 FY24", "FY24", "Custom"];

export function TopBar() {
  const { role, setRole, period, setPeriod } = useApp();
  const [unread, setUnread] = useState(notifications.filter((n) => !n.read).length);
  const [openNotif, setOpenNotif] = useState(false);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-2xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search vendors, POs, projects, invoices..."
          className="w-full h-9 pl-10 pr-16 rounded-md border border-border bg-surface-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background">
          ⌘K
        </kbd>
      </div>

      {/* Period selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="h-9 px-3 rounded-md border border-border bg-surface text-[13px] flex items-center gap-2 hover:border-accent">
          <span className="text-muted-foreground">Period:</span>
          <span className="font-semibold">{period}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PERIODS.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setPeriod(p)}>
              {p}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <DropdownMenu open={openNotif} onOpenChange={setOpenNotif}>
        <DropdownMenuTrigger className="relative h-9 w-9 rounded-md border border-border bg-surface flex items-center justify-center hover:border-accent">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96 p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm">Notifications</span>
            <button
              onClick={() => setUnread(0)}
              className="text-[11px] text-accent hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      n.severity === "critical" && "bg-danger",
                      n.severity === "warning" && "bg-warning",
                      n.severity === "info" && "bg-accent",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{n.title}</div>
                    <div className="text-[12px] text-muted-foreground">{n.description}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{n.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="h-9 pl-1 pr-2 rounded-md border border-border bg-surface flex items-center gap-2 hover:border-accent">
          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
            {roleInitials("Demo User")}
          </div>
          <div className="text-left leading-tight">
            <div className="text-[12px] font-semibold">Demo User</div>
            <div className="text-[10px] text-muted-foreground">{role}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>View as role</DropdownMenuLabel>
          {ROLES.map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => setRole(r)}
              className={cn(role === r && "bg-secondary font-semibold")}
            >
              {r}
              {role === r && <span className="ml-auto text-accent">●</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserIcon className="h-4 w-4 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
