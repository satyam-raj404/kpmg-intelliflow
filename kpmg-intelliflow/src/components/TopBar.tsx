import { Search, ChevronDown, LogOut, User as UserIcon, Sun, Moon, Contrast, ALargeSmall } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useApp, ROLES, roleInitials, DEFAULT_PROFILE } from "@/context/AppContext";
import { useTheme, type FontSize } from "@/hooks/useTheme";
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

const FONT_SIZES: { value: FontSize; label: string; title: string }[] = [
  { value: "sm", label: "S", title: "Small text" },
  { value: "md", label: "M", title: "Medium text (default)" },
  { value: "lg", label: "L", title: "Large text" },
];

function fireLogout(user: { name: string; email: string }, role: string) {
  fetch("http://localhost:8001/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: user.name, user_email: user.email, role, action: "LOGOUT" }),
  }).catch(() => {});
}

export function TopBar() {
  const { role, setRole, period, setPeriod, user, setUser } = useApp();
  const navigate = useNavigate();
  const { theme, toggle, fontSize, setFontSize, contrast, toggleContrast } = useTheme();

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

      {/* ── Theme toggle ─────────────────────────────── */}
      <div className="flex items-center h-8 rounded-md border border-border bg-background overflow-hidden">
        <button
          onClick={() => toggle()}
          title="Switch to KPMG Light theme"
          className={cn(
            "h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium transition-all duration-200",
            theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50",
          )}
        >
          <Sun className="h-3 w-3" />
          <span className="hidden xl:inline">Light</span>
        </button>
        <button
          onClick={() => toggle()}
          title="Switch to Dark theme"
          className={cn(
            "h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium transition-all duration-200",
            theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50",
          )}
        >
          <Moon className="h-3 w-3" />
          <span className="hidden xl:inline">Dark</span>
        </button>
      </div>

      {/* ── Font size toggle ──────────────────────────── */}
      <div
        className="flex items-center h-8 rounded-md border border-border bg-background overflow-hidden"
        title="Text size"
      >
        <div className="flex items-center px-2 border-r border-border text-muted-foreground/50 h-full">
          <ALargeSmall className="h-3 w-3" />
        </div>
        {FONT_SIZES.map(({ value, label, title }) => (
          <button
            key={value}
            onClick={() => setFontSize(value)}
            title={title}
            className={cn(
              "h-full px-2.5 text-[11px] font-medium transition-all duration-200",
              fontSize === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Contrast toggle ───────────────────────────── */}
      <button
        onClick={toggleContrast}
        title={contrast === "normal" ? "Enable high contrast" : "Disable high contrast"}
        className={cn(
          "h-8 px-2.5 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200",
          contrast === "high"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background border-border text-muted-foreground hover:border-accent/40 hover:bg-secondary/50",
        )}
      >
        <Contrast className="h-3 w-3" />
        <span className="hidden xl:inline">{contrast === "high" ? "High" : "Contrast"}</span>
      </button>

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
          <DropdownMenuItem
            onClick={() => {
              fireLogout(user, role);
              setUser(DEFAULT_PROFILE);
              setRole("Procurement Manager");
              localStorage.removeItem("intellisource_user_profile");
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.header>
  );
}
