import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Copy, Check, ShieldAlert, RefreshCw, UserX, UserCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { apiFetch } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "User Management — KPMG IntelliSource" }] }),
  component: UserManagement,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: number;
  created_at: string;
}

interface CreatedUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  generated_password: string;
}

const ALL_ROLES = [
  "Procurement Manager",
  "Delivery Manager",
  "Finance User",
  "Compliance Officer",
  "CXO",
  "Admin",
  "Leadership",
  "Partner",
  "Consultant",
  "Manager",
  "Director",
  "Associate Director",
];

const ROLE_TONES: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "Admin":               "danger",
  "Leadership":          "info",
  "Partner":             "info",
  "Director":            "info",
  "Associate Director":  "info",
  "CXO":                 "info",
  "Consultant":          "neutral",
  "Manager":             "neutral",
  "Procurement Manager": "success",
  "Delivery Manager":    "success",
  "Finance User":        "neutral",
  "Compliance Officer":  "warning",
};

// ── Credential Modal ───────────────────────────────────────────────────────────

function CredentialModal({
  user,
  onClose,
}: {
  user: CreatedUser | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copy = () => {
    navigator.clipboard.writeText(user.generated_password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <UserCheck className="h-4 w-4" />
            User Created Successfully
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="bg-warning/8 border border-warning/30 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-[12px] text-warning leading-snug">
              This password is shown <strong>only once</strong>. Copy and share it with the user now — it cannot be retrieved again.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">User Details</div>
            <div className="bg-secondary/50 rounded-lg px-3 py-2 text-[12px] space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{user.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium font-tabular">{user.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium">{user.role}</span></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Generated Password</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-secondary rounded-md px-3 py-2 text-[14px] font-mono font-semibold tracking-widest text-foreground select-all">
                {user.generated_password}
              </code>
              <button
                onClick={copy}
                className={cn(
                  "h-9 w-9 rounded-md border flex items-center justify-center transition-colors shrink-0",
                  copied ? "border-success/40 bg-success/10 text-success" : "border-border hover:border-accent/50 hover:bg-secondary text-muted-foreground",
                )}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-9 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            Done — I've saved the password
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add User Sheet ─────────────────────────────────────────────────────────────

function AddUserSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: CreatedUser) => void;
}) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "Procurement Manager" });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<CreatedUser>("/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: (data) => {
      onClose();
      setForm({ full_name: "", email: "", role: "Procurement Manager" });
      onCreated(data);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Add New User
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="e.g. Priya Sharma"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. priya.sharma@kpmg.com"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="bg-secondary/50 rounded-lg px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
            A secure password will be auto-generated and shown <strong>once</strong> after creation. Share it with the user immediately.
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.email || !form.full_name}
            className="w-full h-9 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mt-2"
          >
            {mutation.isPending ? "Creating…" : "Create User & Generate Password"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Edit User Dialog ───────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  onClose,
}: {
  user: AppUser | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [role, setRole] = useState(user?.role ?? "");

  const mutation = useMutation({
    mutationFn: (body: { role?: string; is_active?: number }) =>
      apiFetch(`/auth/users/${user!.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="text-[12px] text-muted-foreground">{user.email}</div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => mutation.mutate({ role })}
              disabled={mutation.isPending}
              className="flex-1 h-9 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => mutation.mutate({ is_active: user.is_active ? 0 : 1 })}
              disabled={mutation.isPending}
              className={cn(
                "flex-1 h-9 rounded-md text-[13px] font-medium border transition-colors",
                user.is_active
                  ? "border-danger/40 text-danger hover:bg-danger/10"
                  : "border-success/40 text-success hover:bg-success/10",
              )}
            >
              {user.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

function UserManagement() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<AppUser[]>("/auth/users"),
    staleTime: 30_000,
  });

  const resetPwdMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<CreatedUser & { email: string; full_name: string }>(`/auth/users/${userId}/reset-password`, { method: "POST" }),
    onSuccess: (data, userId) => {
      const user = users.find((u) => u.user_id === userId);
      setCreatedUser({
        user_id: userId,
        email: data.email,
        full_name: data.full_name,
        role: user?.role ?? "",
        generated_password: data.generated_password,
      });
      toast.success("Password reset — share the new password with the user");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return s; }
  };

  return (
    <AppShell>
      <PageHeader
        title="User Management"
        subtitle="Provision access · Assign roles · Manage credentials"
        showExport={false}
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add User
          </button>
        }
      />

      <SectionCard
        title="Users"
        subtitle={`${users.filter((u) => u.is_active).length} active · ${users.filter((u) => !u.is_active).length} inactive`}
      >
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No users yet. Click <strong className="mx-1">Add User</strong> to provision access.
          </div>
        ) : (
          <div className="overflow-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  {["Full Name", "Email", "Role", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.user_id}
                    className={cn(
                      "border-b border-border/40 transition-colors hover:bg-secondary/30",
                      !u.is_active && "opacity-50",
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{u.full_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-tabular">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={ROLE_TONES[u.role] ?? "neutral"}>{u.role}</StatusPill>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          title="Edit role / status"
                          className="h-7 px-2 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => resetPwdMutation.mutate(u.user_id)}
                          disabled={resetPwdMutation.isPending}
                          title="Reset password"
                          className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-warning hover:border-warning/50 transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <AddUserSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u) => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          setCreatedUser(u);
        }}
      />

      <CredentialModal
        user={createdUser}
        onClose={() => setCreatedUser(null)}
      />

      <EditUserDialog
        user={editUser}
        onClose={() => {
          setEditUser(null);
          qc.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    </AppShell>
  );
}
