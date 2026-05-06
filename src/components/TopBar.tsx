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
    <header className="h-13 bg-surface border-b border-border flex items-center px-6 gap-3 sticky top-0 z-30">
      <div className="flex-1 max-w-lg relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full h-8 pl-8 pr-12 rounded-md border border-border bg-background text-[13px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground/50 border border-border rounded px-1 py-0.5 bg-background">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger className="h-8 px-2.5 rounded-md border border-border bg-background text-[12px] flex items-center gap-1.5 hover:border-accent/50 transition-colors">
          <span className="text-muted-foreground">Period:</span>
          <span className="font-medium">{period}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PERIODS.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setPeriod(p)}>{p}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={openNotif} onOpenChange={setOpenNotif}>
        <DropdownMenuTrigger className="relative h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center hover:border-accent/50 transition-colors">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="font-medium text-[13px]">Notifications</span>
            <button onClick={() => setUnread(0)} className="text-[11px] text-accent hover:underline">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/50 cursor-pointer">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                    n.severity === "critical" && "bg-danger",
                    n.severity === "warning" && "bg-warning",
                    n.severity === "info" && "bg-accent",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground">{n.description}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{n.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="h-8 pl-0.5 pr-2 rounded-md border border-border bg-background flex items-center gap-2 hover:border-accent/50 transition-colors">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {roleInitials("Demo User")}
          </div>
          <div className="text-left leading-tight hidden xl:block">
            <div className="text-[11px] font-medium">Demo User</div>
            <div className="text-[9px] text-muted-foreground">{role}</div>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[11px]">View as role</DropdownMenuLabel>
          {ROLES.map((r) => (
            <DropdownMenuItem key={r} onClick={() => setRole(r)} className={cn(role === r && "bg-secondary font-medium")}>
              {r}
              {role === r && <span className="ml-auto text-accent text-[8px]">●</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem><UserIcon className="h-3.5 w-3.5 mr-2" /> Profile</DropdownMenuItem>
          <DropdownMenuItem><LogOut className="h-3.5 w-3.5 mr-2" /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
