import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useApp, ROLES, DEMO_PERSONAS } from "@/context/AppContext";
import { apiFetch } from "@/api/client";
import type { Role } from "@/types";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — KPMG IntelliSource" }] }),
  component: Login,
});

function Login() {
  const { setRole, setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ user_id: string; email: string; full_name: string; role: string }>(
        "/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      setUser({
        name: data.full_name,
        email: data.email,
        jobTitle: data.role,
        department: "",
        phone: "",
        avatarColor: "#00338D",
      });
      setRole(data.role as Role);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const pickRole = (r: Role) => {
    const persona = DEMO_PERSONAS[r];
    setRole(r);
    setUser(persona);
    setEmail(persona.email);
    setPassword("demo1234");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left */}
      <div className="w-[420px] bg-sidebar text-sidebar-foreground flex flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <Logo variant="white" size={28} />
          <span className="text-[15px] font-semibold tracking-tight">IntelliSource</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Procurement<br />Process Intelligence
          </h1>
          <p className="text-[14px] mt-3 text-sidebar-foreground/60 leading-relaxed">
            End-to-end P2P visibility across 487 vendors and ₹500+ Cr annual procurement.
          </p>
          <div className="mt-10 pt-6 border-t border-sidebar-border grid grid-cols-3 gap-4 hidden">
            {[
              { n: "8", l: "Activities" },
              { n: "38", l: "KPIs" },
              { n: "5", l: "Dashboards" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl font-semibold font-tabular">{s.n}</div>
                <div className="text-[11px] text-sidebar-foreground/40 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-sidebar-foreground/30">© 2024 KPMG. All rights reserved.</div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center px-12 py-10">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-[13px] text-muted-foreground mt-1">Use your KPMG credentials</p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kpmg.com or admin"
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none text-[13px]"
              />
            </div>
            <div className="flex justify-end">
              <a href="#" className="text-[11px] text-accent hover:underline">Forgot password?</a>
            </div>
            {error && (
              <p className="text-[12px] text-danger bg-danger/8 border border-danger/20 rounded-md px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <button
              type="button"
              className="w-full h-9 rounded-md border border-border bg-background text-[13px] font-medium flex items-center justify-center gap-2 hover:border-accent/50 transition-colors"
            >
              SSO with Azure AD
            </button>
          </form>

          <div className="mt-5 text-center text-[11px] text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-accent font-medium hover:underline">Create account</Link>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-[10px] font-medium text-muted-foreground mb-2.5">Demo — click to auto-fill</div>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickRole(r)}
                  className="text-[10px] px-2 py-1 rounded-md border border-border bg-background hover:border-accent/50 hover:bg-secondary font-medium transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
