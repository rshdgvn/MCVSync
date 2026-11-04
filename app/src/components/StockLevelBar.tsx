import { formatNumber, percentOf } from "@/lib/format";
import { TONE_FILL_CLASS, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

interface StockLevelBarProps {
  available: number;
  reorderPoint: number | null;
  className?: string;
}

function stockTone(available: number, reorderPoint: number | null): Tone {
  if (available <= 0) {
    return "danger";
  }
  if (reorderPoint !== null && available <= reorderPoint) {
    return "warning";
  }
  return "success";
}

export function StockLevelBar({ available, reorderPoint, className }: StockLevelBarProps) {
  const hasReorderPoint = reorderPoint !== null && reorderPoint > 0;
  const percent = hasReorderPoint ? percentOf(available, reorderPoint * 2) : available > 0 ? 100 : 0;
  const tone = stockTone(available, reorderPoint);
  const label = hasReorderPoint
    ? `${formatNumber(Math.max(available, 0))} left · ${percent}%`
    : `${formatNumber(Math.max(available, 0))} left`;

  return (
    <div className={cn("flex min-w-28 flex-col gap-1", className)}>
      <span className="text-xs text-foreground-soft tabular-nums">{label}</span>
      <div
        role="meter"
        aria-label="Stock level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={hasReorderPoint ? `${label}, reorder point ${reorderPoint}` : label}
        className="h-1.5 w-full bg-muted"
      >
        <div className={cn("h-full", TONE_FILL_CLASS[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
