import { Construction } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <div className="border border-border bg-card">
        <EmptyState
          icon={Construction}
          title="Not yet built"
          description="This page is scaffolded and will be filled in during a future build pass."
        />
      </div>
    </div>
  );
}
