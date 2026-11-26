import { Check, Circle, X } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CofDetail, CofStatus } from "@/types/clientOrderForm";

const STAGES: { status: CofStatus; label: string }[] = [
  { status: "pending_approval", label: "Pending Approval" },
  { status: "processing", label: "Processing" },
  { status: "ready_for_delivery", label: "Ready for Delivery" },
  { status: "delivered", label: "Delivered" },
  { status: "completed", label: "Completed" },
];

function stageIndex(status: CofStatus): number {
  return STAGES.findIndex((stage) => stage.status === status);
}

function stageDate(cof: CofDetail, status: CofStatus): string | null {
  switch (status) {
    case "pending_approval":
      return cof.created_at ? formatDateTime(cof.created_at) : null;
    case "processing":
      return cof.forwarded_at ? formatDateTime(cof.forwarded_at) : null;
    case "ready_for_delivery":
      return cof.ready_for_delivery_at ? formatDateTime(cof.ready_for_delivery_at) : null;
    case "delivered":
      return cof.delivery ? `${formatDate(cof.delivery.delivery_date)} · received by ${cof.delivery.received_by}` : null;
    default:
      return null;
  }
}

export function CofStatusTimeline({ cof }: { cof: CofDetail }) {
  const cancelled = cof.order_status === "cancelled";
  const current = cof.order_status === "needs_revision" ? 0 : stageIndex(cof.order_status);

  return (
    <ol className="flex flex-col gap-0" aria-label="Order progress">
      {STAGES.map((stage, index) => {
        const done = !cancelled && index < current;
        const active = !cancelled && index === current;
        const date = stageDate(cof, stage.status);
        return (
          <li key={stage.status} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center border",
                  done && "border-success bg-success-muted text-success",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-card text-faint",
                )}
              >
                {done ? <Check className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
              </span>
              {index < STAGES.length - 1 && <span className="w-px flex-1 bg-border" />}
            </span>
            <span className="flex flex-col pb-4">
              <span className={cn("text-sm md:text-ui", active ? "font-semibold text-foreground" : "text-foreground-soft")}>
                {stage.label}
                {active && cof.order_status === "needs_revision" && " · sent back for revision"}
              </span>
              {date && <span className="text-xs text-muted-foreground">{date}</span>}
            </span>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex items-center gap-3">
          <span className="flex size-6 items-center justify-center border border-danger bg-danger-muted text-danger">
            <X className="size-3.5" />
          </span>
          <span className="text-sm font-semibold text-danger md:text-ui">Cancelled</span>
        </li>
      )}
    </ol>
  );
}
