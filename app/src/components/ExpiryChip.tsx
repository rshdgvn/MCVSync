import { StatusBadge } from "@/components/StatusBadge";
import { daysUntil, formatDate } from "@/lib/format";

interface ExpiryChipProps {
  expiryDate: string | null;
  thresholdDays: number;
}

function expiryLabel(days: number): string {
  if (days < 0) {
    return "Expired";
  }
  if (days === 0) {
    return "Expires today";
  }
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function ExpiryChip({ expiryDate, thresholdDays }: ExpiryChipProps) {
  if (!expiryDate) {
    return <span className="text-xs text-faint">No expiry</span>;
  }

  const days = daysUntil(expiryDate);
  const tone = days < 0 ? "danger" : days <= thresholdDays ? "warning" : "neutral";

  return (
    <span title={`Expires ${formatDate(expiryDate)}`} className="inline-flex flex-col items-start gap-0.5">
      <StatusBadge status="expiry" tone={tone} label={expiryLabel(days)} />
      <span className="text-[11px] text-faint">{formatDate(expiryDate)}</span>
    </span>
  );
}
