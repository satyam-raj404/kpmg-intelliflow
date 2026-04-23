import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — KPMG IntelliSource" }] }),
  component: () => (
    <AppShell>
      <PageHeader title="Settings" subtitle="System configuration" />
      <SectionCard title="System Settings" subtitle="Thresholds, integrations, notifications">
        <p className="text-[13px] text-muted-foreground">Configure SAP integration endpoints, ABAC thresholds, notification routing, and dashboard refresh intervals.</p>
      </SectionCard>
    </AppShell>
  ),
});
