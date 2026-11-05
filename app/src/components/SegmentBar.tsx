import { formatNumber, percentOf } from "@/lib/format";
import { TONE_FILL_CLASS, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface Segment {
  label: string;
  value: number;
  tone: Tone;
}

interface SegmentBarProps {
  segments: Segment[];
  label: string;
}

export function SegmentBar({ segments, label }: SegmentBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <figure className="space-y-2">
      <div role="img" aria-label={label} className="flex h-2 w-full overflow-hidden bg-muted">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={cn("h-full", TONE_FILL_CLASS[segment.tone])}
              style={{ width: `${percentOf(segment.value, total)}%` }}
            />
          ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5 text-xs text-foreground-soft">
            <span aria-hidden="true" className={cn("size-2", TONE_FILL_CLASS[segment.tone])} />
            {segment.label}
            <span className="font-mono font-semibold text-foreground tabular-nums">{formatNumber(segment.value)}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
