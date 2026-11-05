import { createFileRoute } from "@tanstack/react-router";
import { MicroLabel } from "@/components/MicroLabel";
import { PageHeader } from "@/components/PageHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { useMeQuery } from "@/hooks/useAuth";
import { statusInfo } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const user = useMeQuery().data;

  if (!user) {
    return null;
  }

  const details = [
    { label: "Email", value: user.email },
    { label: "Account Type", value: user.client_type ? statusInfo(user.client_type).label : "Not set" },
    { label: "Zone", value: user.zone?.name ?? "Unassigned" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Welcome, ${user.name}`} description="Your client account at a glance." />
      <section className="border border-border bg-card">
        <div className="border-b border-border-subtle px-4 py-3">
          <SectionTitle>Account</SectionTitle>
        </div>
        <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex min-w-0 flex-col gap-1">
              <dt>
                <MicroLabel>{detail.label}</MicroLabel>
              </dt>
              <dd className="truncate text-sm font-medium text-foreground md:text-ui">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
