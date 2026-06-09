import { useState } from "react";
import { Search, Bell, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
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
  const { role, setRole, period, setPeriod, user } = useApp();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(notifications.filter((n) => !n.read).length);
  const [openNotif, setOpenNotif] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-13 bg-surface/80 backdrop-blur-md border-b border-border flex items-center px-6 gap-3 sticky top-0 z-30"
    >
      <div className="flex-1 max-w-lg relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full h-8 pl-8 pr-12 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all duration-200"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground/40 border border-border rounded px-1 py-0.5 bg-background">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger className="h-8 px-2.5 rounded-md border border-border bg-background text-[13px] flex items-center gap-1.5 hover:border-accent/40 hover:bg-secondary/50 transition-all duration-200">
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
        <DropdownMenuTrigger className="relative h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center hover:border-accent/40 hover:bg-secondary/50 transition-all duration-200">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center"
            >
              {unread}
            </motion.span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="font-medium text-sm">Notifications</span>
            <button onClick={() => setUnread(0)} className="text-[12px] text-accent hover:underline">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className="px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/50 cursor-pointer transition-colors duration-150"
              >
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                    n.severity === "critical" && "bg-danger",
                    n.severity === "warning" && "bg-warning",
                    n.severity === "info" && "bg-accent",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{n.title}</div>
                    <div className="text-[12px] text-muted-foreground">{n.description}</div>
                    <div className="text-[11px] text-muted-foreground/50 mt-0.5">{n.time}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="h-8 pl-0.5 pr-2 rounded-md border border-border bg-background flex items-center gap-2 hover:border-accent/40 hover:bg-secondary/50 transition-all duration-200">
          <div
            className="h-6 w-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: user.avatarColor }}
          >
            {roleInitials(user.name)}
          </div>
          <div className="text-left leading-tight hidden xl:block">
            <div className="text-[12px] font-medium">{user.name}</div>
            <div className="text-[9px] text-muted-foreground">{role}</div>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[12px]">View as role</DropdownMenuLabel>
          {ROLES.map((r) => (
            <DropdownMenuItem key={r} onClick={() => setRole(r)} className={cn(role === r && "bg-secondary font-medium")}>
              {r}
              {role === r && <span className="ml-auto text-accent text-[8px]">●</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
            <UserIcon className="h-3.5 w-3.5 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem><LogOut className="h-3.5 w-3.5 mr-2" /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.header>
  );
}
