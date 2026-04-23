import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useApp, ROLES } from "@/context/AppContext";
import type { Role } from "@/types";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — KPMG IntelliSource" }] }),
  component: Login,
});

function Login() {
  const { setRole } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/" });
  };

  const pickRole = (r: Role) => {
    setRole(r);
    setEmail(`${r.toLowerCase().replace(/\s+/g, ".")}@kpmg.com`);
    setPassword("demo1234");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="w-2/5 bg-primary text-white flex flex-col justify-between p-12">
        <Logo variant="white" size={48} />
        <div>
          <h1 className="text-4xl font-serif font-bold leading-tight">IntelliSource</h1>
          <p className="text-xl mt-2 text-white/80 font-serif italic">
            Procurement Process Optimization
          </p>
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm text-white/60 uppercase tracking-wider font-semibold">
              Trusted by leadership
            </p>
            <p className="text-2xl mt-2 font-serif">
              Managing ₹500+ Cr in annual procurement across 487 vendors.
            </p>
          </div>
        </div>
        <div className="text-[11px] text-white/50">© 2024 KPMG. All rights reserved.</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center bg-background px-12 py-10">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-serif font-bold">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground mt-1">Use your KPMG credentials</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
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
                placeholder="••••••••"
                className="mt-1 w-full h-10 px-3 rounded border border-border bg-surface focus:border-accent focus:outline-none text-sm"
              />
            </div>
            <div className="flex justify-end">
              <a href="#" className="text-[12px] text-accent hover:underline">
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary-dark"
            >
              Sign In
            </button>
            <button
              type="button"
              className="w-full h-10 rounded border border-border bg-surface font-semibold flex items-center justify-center gap-2 hover:border-accent"
            >
              <span className="text-[14px]">⊞</span> SSO with KPMG Azure AD
            </button>
          </form>

          <div className="mt-6 text-center text-[12px] text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-accent font-semibold hover:underline">
              Create account
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-border">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              Demo accounts — click to auto-fill
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickRole(r)}
                  className="text-[11px] px-2.5 py-1.5 rounded border border-border bg-surface hover:border-accent hover:bg-secondary font-semibold"
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
