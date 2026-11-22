import { MicroLabel } from "@/components/MicroLabel";
import { formatQuantity } from "@/lib/format";

interface ShortageSummaryProps {
  requested: number;
  available: number;
  unit?: string | null;
}

export function shortfallOf(requested: number, available: number): number {
  return Math.max(1, requested - available);
}

export function ShortageSummary({ requested, available, unit }: ShortageSummaryProps) {
  return (
    <dl className="grid grid-cols-3 gap-2 border border-border-subtle bg-subtle px-3 py-2.5">
      {[
        { label: "Requested", value: requested, className: "text-foreground" },
        { label: "Available", value: available, className: "text-success" },
        { label: "Shortage", value: shortfallOf(requested, available), className: "text-danger" },
      ].map((stat) => (
        <div key={stat.label} className="grid gap-0.5">
          <dt>
            <MicroLabel>{stat.label}</MicroLabel>
          </dt>
          <dd className={`font-mono text-base font-bold ${stat.className}`}>{formatQuantity(stat.value, unit)}</dd>
        </div>
      ))}
    </dl>
  );
}
