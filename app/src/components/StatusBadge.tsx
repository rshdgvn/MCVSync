import { statusInfo, TONE_BADGE_CLASS, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const info = statusInfo(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-[7px] py-0.5 text-[11px] leading-4 font-semibold tracking-[0.02em] whitespace-nowrap",
        TONE_BADGE_CLASS[tone ?? info.tone],
        className,
      )}
    >
      {label ?? info.label}
    </span>
  );
}
