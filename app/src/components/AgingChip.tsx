import { StatusBadge } from "@/components/StatusBadge";

interface AgingChipProps {
  days: number;
  warnAt: number;
  dangerAt: number;
  suffix?: string;
}

export function AgingChip({ days, warnAt, dangerAt, suffix = "days" }: AgingChipProps) {
  const label = `${days} ${days === 1 ? suffix.replace(/s$/, "") : suffix}`;

  if (days >= dangerAt) {
    return <StatusBadge status="aging" tone="danger" label={label} />;
  }
  if (days >= warnAt) {
    return <StatusBadge status="aging" tone="warning" label={label} />;
  }
  return <span className="text-xs text-foreground-soft tabular-nums">{label}</span>;
}
