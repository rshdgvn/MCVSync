import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/unauthorized")({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="border border-border bg-card">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your role doesn't include this section. If you think this is a mistake, contact your administrator."
        action={
          <Button variant="outline" size="sm" render={<Link to="/" />}>
            Back to Home
          </Button>
        }
      />
    </div>
  );
}
