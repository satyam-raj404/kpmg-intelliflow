import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { useApp, roleInitials, type UserProfile } from "@/context/AppContext";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — KPMG IntelliSource" }] }),
  component: ProfilePage,
});

const AVATAR_COLORS = [
  { label: "Navy",    value: "#0B1F45" },
  { label: "Teal",    value: "#0B7A75" },
  { label: "Purple",  value: "#470A68" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber",   value: "#d97706" },
  { label: "Indigo",  value: "#6366f1" },
];

function ProfilePage() {
  const { user, setUser, role } = useApp();
  const [form, setForm] = useState<UserProfile>({ ...user });
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUser(form);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDiscard = () => {
    setForm({ ...user });
    setEditing(false);
  };

  const set = (field: keyof UserProfile, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <AppShell>
      <PageHeader title="My Profile" subtitle="Manage your personal information and preferences" />

      <div className="grid grid-cols-3 gap-4 mt-2">
        {/* Left — Avatar + meta */}
        <div className="col-span-1 flex flex-col gap-4">
          <SectionCard title="Avatar" subtitle="Pick a colour">
            <div className="flex flex-col items-center gap-4 py-2">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold select-none shadow-md"
                style={{ background: form.avatarColor }}
              >
                {roleInitials(form.name || "DU")}
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => { set("avatarColor", c.value); setEditing(true); }}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      background: c.value,
                      borderColor: form.avatarColor === c.value ? "#fff" : "transparent",
                      boxShadow: form.avatarColor === c.value ? `0 0 0 2px ${c.value}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Account" subtitle="">
            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Role</span>
                <span className="bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5 rounded-full">{role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account Type</span>
                <span className="text-foreground font-medium">Demo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground font-medium">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right — Edit form */}
        <div className="col-span-2">
          <SectionCard
            title="Personal Information"
            subtitle="Your details are stored locally in this browser"
          >
            <form onSubmit={handleSave} className="space-y-4 mt-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" value={form.name} onChange={(v) => { set("name", v); setEditing(true); }} placeholder="Your full name" />
                <Field label="Email Address" value={form.email} onChange={(v) => { set("email", v); setEditing(true); }} placeholder="you@kpmg.com" type="email" />
                <Field label="Job Title" value={form.jobTitle} onChange={(v) => { set("jobTitle", v); setEditing(true); }} placeholder="e.g. Procurement Manager" />
                <Field label="Department" value={form.department} onChange={(v) => { set("department", v); setEditing(true); }} placeholder="e.g. Supply Chain" />
                <Field label="Phone" value={form.phone} onChange={(v) => { set("phone", v); setEditing(true); }} placeholder="+91 98765 43210" type="tel" />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <button
                  type="submit"
                  disabled={!editing}
                  className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Pencil className="h-3 w-3" />
                  Save Changes
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="h-8 px-4 rounded-md border border-border bg-background text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Discard
                  </button>
                )}
                {saved && (
                  <span className="flex items-center gap-1 text-[12px] text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" /> Profile saved
                  </span>
                )}
              </div>
            </form>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
      />
    </div>
  );
}
