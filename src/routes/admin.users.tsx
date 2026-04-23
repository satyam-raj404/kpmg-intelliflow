import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "User Management — KPMG IntelliSource" }] }),
  component: () => (
    <AppShell>
      <PageHeader title="User Management" subtitle="Roles, permissions and access control" />
      <SectionCard title="Coming soon" subtitle="Admin module — role assignment, SSO mapping, ABAC policies">
        <p className="text-[13px] text-muted-foreground">This module will manage user accounts, role assignments, and permission policies. Hooks into KPMG Azure AD for SSO.</p>
      </SectionCard>
    </AppShell>
  ),
});
