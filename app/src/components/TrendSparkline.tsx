import { cn } from "@/lib/utils";

interface TrendSparklineProps {
  values: number[];
  label: string;
  className?: string;
}

const WIDTH = 72;
const HEIGHT = 24;
const PADDING = 2;

function toPoints(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (WIDTH - PADDING * 2) / (values.length - 1);

  return values
    .map((value, index) => {
      const x = PADDING + index * step;
      const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function TrendSparkline({ values, label, className }: TrendSparklineProps) {
  if (values.length < 2) {
    return null;
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={cn("shrink-0 text-primary", className)}
    >
      <polyline
        points={toPoints(values)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
