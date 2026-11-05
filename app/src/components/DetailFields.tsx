import type { ReactNode } from "react";
import { MicroLabel } from "@/components/MicroLabel";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function DetailCard({ title, children, className }: DetailCardProps) {
  return (
    <section className={cn("border border-border bg-card p-4", className)}>
      <MicroLabel className="mb-3">{title}</MicroLabel>
      <dl className="grid gap-3">{children}</dl>
    </section>
  );
}

interface DetailFieldProps {
  label: string;
  children: ReactNode;
}

export function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-micro font-bold tracking-[0.07em] text-faint uppercase">{label}</dt>
      <dd className="text-sm text-foreground md:text-ui">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
