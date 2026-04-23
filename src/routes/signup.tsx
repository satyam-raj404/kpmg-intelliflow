import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useApp, ROLES } from "@/context/AppContext";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create Account — KPMG IntelliSource" }] }),
  component: Signup,
});

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  "Procurement Manager":
    "Full access to procurement dashboards, PO monitoring, vendor performance and P2P tracker.",
  "Delivery Manager":
    "Project-level visibility — utilization, vendor delivery scores, and operational KPIs.",
  "Finance User":
    "Financial dashboard, budget utilization, invoice processing, TDS and GST views.",
  "Compliance Officer":
    "Compliance Center, ABAC checks, breach history, audit trail and rule library.",
  CXO: "Leadership dashboard with portfolio-level KPIs, strategic risk and cost savings.",
  Admin: "Full administrative access — user management, audit logs and platform settings.",
};

function Signup() {
  const { setRole } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!selectedRole) {
      setError("Please select a role to determine your access level.");
      return;
    }
    setRole(selectedRole);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="w-2/5 bg-primary text-white flex flex-col justify-between p-12">
        <Logo variant="white" size={48} />
        <div>
          <h1 className="text-4xl font-serif font-bold leading-tight">Join IntelliSource</h1>
          <p className="text-xl mt-2 text-white/80 font-serif italic">
            Role-based access for every procurement stakeholder
          </p>
          <div className="mt-12 pt-8 border-t border-white/20 space-y-3">
            <p className="text-sm text-white/60 uppercase tracking-wider font-semibold">
              What you get
            </p>
            <ul className="space-y-2 text-[14px] text-white/85">
              <li className="flex gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" /> Real-time visibility across the
                P2P lifecycle
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" /> Automated ABAC compliance &
                breach alerts
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" /> Dashboards tailored to your role
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" /> Single source of truth across
                SAP, HRMS & vendors
              </li>
            </ul>
          </div>
        </div>
        <div className="text-[11px] text-white/50">© 2024 KPMG. All rights reserved.</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center bg-background px-12 py-10 overflow-y-auto">
        <div className="w-full max-w-xl">
          <h2 className="text-2xl font-serif font-bold">Create your account</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a role — your dashboards and permissions will be configured accordingly.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full h-10 px-3 rounded border border-border bg-surface focus:border-accent focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@kpmg.com"
                  className="mt-1 w-full h-10 px-3 rounded border border-border bg-surface focus:border-accent focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-1 w-full h-10 px-3 rounded border border-border bg-surface focus:border-accent focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full h-10 px-3 rounded border border-border bg-surface focus:border-accent focus:outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                Select your role
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Determines which dashboards and modules you can access.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const active = selectedRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={cn(
                        "text-left p-3 rounded border bg-surface transition-colors",
                        active
                          ? "border-accent bg-secondary ring-2 ring-accent/30"
                          : "border-border hover:border-accent",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold">{r}</span>
                        {active && (
                          <span className="h-4 w-4 rounded-full bg-accent text-white flex items-center justify-center">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {ROLE_DESCRIPTIONS[r]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-10 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary-dark"
            >
              Create account
            </button>
          </form>

          <div className="mt-5 text-center text-[12px] text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
