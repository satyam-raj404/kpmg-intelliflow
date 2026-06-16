import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { Role } from "@/types";

export interface UserProfile {
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  phone: string;
  avatarColor: string;
}

export interface HistoryEntry {
  id: string;
  type: "upload" | "download";
  label: string;
  detail: string;
  user: string;
  timestamp: string;
  status: "success" | "failed" | "pending";
}

interface AppContextValue {
  role: Role;
  setRole: (r: Role) => void;
  period: string;
  setPeriod: (p: string) => void;
  user: UserProfile;
  setUser: (u: UserProfile) => void;
  activityLog: HistoryEntry[];
  addActivity: (entry: Omit<HistoryEntry, "id" | "timestamp" | "user">) => void;
  clearHistory: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Demo User",
  email: "demo@kpmg.com",
  jobTitle: "Procurement Analyst",
  department: "Supply Chain",
  phone: "",
  avatarColor: "#0B1F45",
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("Procurement Manager");
  const [period, setPeriod] = useState("Q2 FY24");
  const sessionFired = useRef(false);

  const [user, setUserState] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem("intellisource_user_profile");
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [activityLog, setActivityLog] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem("intellisource_activity_log");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("intellisource_user_profile", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem("intellisource_activity_log", JSON.stringify(activityLog));
  }, [activityLog]);

  useEffect(() => {
    if (sessionFired.current) return;
    sessionFired.current = true;
    fetch("http://localhost:8001/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: user.name, user_email: user.email, role, action: "LOGIN" }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    setUserState((currentUser) => {
      fetch("http://localhost:8001/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: currentUser.name, user_email: currentUser.email, role: r, action: "ROLE_SWITCH" }),
      }).catch(() => {});
      return currentUser;
    });
  }, []);

  const setUser = useCallback((u: UserProfile) => {
    setUserState(u);
  }, []);

  const addActivity = useCallback(
    (entry: Omit<HistoryEntry, "id" | "timestamp" | "user">) => {
      setUserState((currentUser) => {
        const newEntry: HistoryEntry = {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          user: currentUser.name,
        };
        setActivityLog((prev) => [newEntry, ...prev].slice(0, 300));
        return currentUser;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    setActivityLog([]);
  }, []);

  return (
    <AppContext.Provider value={{ role, setRole, period, setPeriod, user, setUser, activityLog, addActivity, clearHistory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export const ROLES: Role[] = [
  "Procurement Manager",
  "Delivery Manager",
  "Finance User",
  "Compliance Officer",
  "CXO",
  "Admin",
];

export const DEMO_PERSONAS: Record<Role, UserProfile> = {
  "Procurement Manager": {
    name: "Priya Sharma",
    email: "priya.sharma@kpmg.com",
    jobTitle: "Sr. Procurement Manager",
    department: "Supply Chain",
    phone: "+91 98765 43210",
    avatarColor: "#0B1F45",
  },
  "Delivery Manager": {
    name: "Arjun Mehta",
    email: "arjun.mehta@kpmg.com",
    jobTitle: "Delivery Director",
    department: "Operations",
    phone: "+91 91234 56789",
    avatarColor: "#0B7A75",
  },
  "Finance User": {
    name: "Neha Gupta",
    email: "neha.gupta@kpmg.com",
    jobTitle: "Finance Analyst",
    department: "Finance",
    phone: "+91 99887 76655",
    avatarColor: "#470A68",
  },
  "Compliance Officer": {
    name: "Rahul Sinha",
    email: "rahul.sinha@kpmg.com",
    jobTitle: "Compliance Officer",
    department: "Legal & Compliance",
    phone: "+91 88990 01122",
    avatarColor: "#d97706",
  },
  "CXO": {
    name: "Ananya Bose",
    email: "ananya.bose@kpmg.com",
    jobTitle: "Chief Procurement Officer",
    department: "Executive",
    phone: "+91 77654 32100",
    avatarColor: "#10b981",
  },
  "Admin": {
    name: "Vikram Nair",
    email: "vikram.nair@kpmg.com",
    jobTitle: "System Administrator",
    department: "IT",
    phone: "+91 80000 12345",
    avatarColor: "#6366f1",
  },
};

export function roleInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
