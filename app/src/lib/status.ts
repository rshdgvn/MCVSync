export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const TONE_BADGE_CLASS: Record<Tone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
  neutral: "bg-neutral-muted text-neutral",
};

export const TONE_FILL_CLASS: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending", tone: "info" },
  open: { label: "Open", tone: "info" },
  requested: { label: "Requested", tone: "info" },
  ready_for_delivery: { label: "Ready for Delivery", tone: "warning" },
  processing: { label: "Processing", tone: "warning" },
  shipped: { label: "In Transit", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  received: { label: "Received", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  released: { label: "Released", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  needs_revision: { label: "Needs Revision", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  payment_due: { label: "Payment Due", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  depleted: { label: "Depleted", tone: "neutral" },
  near_expiry: { label: "Expiring Soon", tone: "warning" },
  low_stock: { label: "Low Stock", tone: "warning" },
  out_of_stock: { label: "Out of Stock", tone: "danger" },
  in_stock: { label: "In Stock", tone: "success" },
  short: { label: "Short", tone: "danger" },
  over: { label: "Over", tone: "warning" },
  not_found: { label: "Not on Document", tone: "neutral" },
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function statusInfo(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: humanize(status), tone: "neutral" };
}
