import { QuantityProgress } from "@/components/QuantityProgress";

interface ReceivedProgressProps {
  received: number;
  shortAccepted: number;
  total: number;
}

export function ReceivedProgress({ received, shortAccepted, total }: ReceivedProgressProps) {
  return (
    <span className="flex flex-col gap-1">
      <QuantityProgress value={received + shortAccepted} total={total} />
      {shortAccepted > 0 && (
        <span className="text-xs whitespace-normal text-muted-foreground">
          {received} received · {shortAccepted} short accepted
        </span>
      )}
    </span>
  );
}
