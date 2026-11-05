const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const MS_PER_DAY = 86_400_000;

function toDate(value: string | number | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return moneyFormatter.format(Number(value));
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

export function formatQuantity(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return unit ? `${numberFormatter.format(value)} ${unit}` : numberFormatter.format(value);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  return value ? dateFormatter.format(toDate(value)) : "—";
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  return value ? dateTimeFormatter.format(toDate(value)) : "—";
}

export function formatTime(value: string | number | Date): string {
  return timeFormatter.format(toDate(value));
}

export function daysUntil(value: string | number | Date, from: Date = new Date()): number {
  const target = toDate(value);
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((startOfTarget - startOfFrom) / MS_PER_DAY);
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) {
    return part > 0 ? 100 : 0;
  }
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

export function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}
