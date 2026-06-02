import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "@/types";

interface AppContextValue {
  role: Role;
  setRole: (r: Role) => void;
  period: string;
  setPeriod: (p: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Procurement Manager");
  const [period, setPeriod] = useState("Q2 FY24");
  return (
    <AppContext.Provider value={{ role, setRole, period, setPeriod }}>
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

export function roleInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
