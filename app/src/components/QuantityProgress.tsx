import { formatNumber, percentOf } from "@/lib/format";
import { TONE_FILL_CLASS, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

interface QuantityProgressProps {
  value: number;
  total: number;
  className?: string;
}

function progressTone(value: number, total: number): Tone {
  if (value > total) {
    return "warning";
  }
  return value === total ? "success" : "info";
}

export function QuantityProgress({ value, total, className }: QuantityProgressProps) {
  const percent = percentOf(value, total);
  const label = `${formatNumber(value)} / ${formatNumber(total)}`;

  return (
    <div className={cn("flex min-w-24 flex-col gap-1", className)}>
      <span className="font-mono text-xs text-foreground-soft tabular-nums">{label}</span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-valuetext={label}
        className="h-1 w-full bg-muted"
      >
        <div className={cn("h-full", TONE_FILL_CLASS[progressTone(value, total)])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
