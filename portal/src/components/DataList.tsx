import type { KeyboardEvent, ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { RefreshingRegion } from "@/components/RefreshingRegion";
import { RowActions, type RowAction } from "@/components/RowActions";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export type DataListMobileSlot = "title" | "subtitle" | "badge" | "meta" | "hidden";

export interface DataListColumn<TRow> {
  key: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  mobile?: DataListMobileSlot;
}

interface DataListEmpty {
  title: string;
  description?: string;
  action?: ReactNode;
}

interface DataListProps<TRow> {
  label: string;
  columns: DataListColumn<TRow>[];
  rows: TRow[] | undefined;
  rowKey: (row: TRow) => string | number;
  isPending: boolean;
  error?: unknown;
  onRetry: () => void;
  empty: DataListEmpty;
  onRowClick?: (row: TRow) => void;
  onRowIntent?: (row: TRow) => void;
  rowActions?: (row: TRow) => RowAction[];
  isRefreshing?: boolean;
  footer?: ReactNode;
  skeletonRows?: number;
}

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

function activateOnKey(event: KeyboardEvent, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

export function DataList<TRow>({
  label,
  columns,
  rows,
  rowKey,
  isPending,
  error,
  onRetry,
  empty,
  onRowClick,
  onRowIntent,
  rowActions,
  isRefreshing = false,
  footer,
  skeletonRows = 6,
}: DataListProps<TRow>) {
  if (isPending) {
    return <DataListSkeleton columns={columns.length} rows={skeletonRows} />;
  }

  if (error && !rows) {
    return (
      <div className="border border-border bg-card">
        <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="border border-border bg-card">
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      </div>
    );
  }

  const titleColumn = columns.find((column) => column.mobile === "title") ?? columns[0];
  const subtitleColumns = columns.filter((column) => column.mobile === "subtitle");
  const badgeColumns = columns.filter((column) => column.mobile === "badge");
  const metaColumns = columns.filter(
    (column) => column !== titleColumn && (column.mobile === undefined || column.mobile === "meta"),
  );
  const hasActions = Boolean(rowActions);

  return (
    <RefreshingRegion isRefreshing={isRefreshing}>
      <div className="border border-border bg-card">
        <div className="hidden md:block">
          <table className="w-full border-collapse" aria-label={label}>
            <thead>
              <tr className="border-b border-border bg-subtle">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-3 py-[7px] text-micro font-bold tracking-[0.07em] whitespace-nowrap text-faint uppercase",
                      ALIGN_CLASS[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
                {hasActions && (
                  <th scope="col" className="w-px px-3 py-[7px]">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => activateOnKey(event, () => onRowClick(row)) : undefined}
                  onMouseEnter={onRowIntent ? () => onRowIntent(row) : undefined}
                  onFocus={onRowIntent ? () => onRowIntent(row) : undefined}
                  className={cn(
                    "border-b border-border-subtle last:border-b-0",
                    onRowClick &&
                      "cursor-pointer transition-colors duration-150 ease-standard outline-none hover:bg-primary-light/50 focus-visible:bg-primary-light",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-[9px] align-middle text-ui text-foreground",
                        ALIGN_CLASS[column.align ?? "left"],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-3 py-1 text-right whitespace-nowrap">
                      <RowActions actions={rowActions(row)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul aria-label={label} className="divide-y divide-border-subtle md:hidden">
          {rows.map((row) => (
            <li
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => activateOnKey(event, () => onRowClick(row)) : undefined}
              onTouchStart={onRowIntent ? () => onRowIntent(row) : undefined}
              className={cn(
                "flex gap-3 px-4 py-3",
                onRowClick && "cursor-pointer outline-none active:bg-subtle focus-visible:bg-primary-light",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-base font-semibold text-foreground">{titleColumn.cell(row)}</div>
                  {badgeColumns.length > 0 && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {badgeColumns.map((column) => (
                        <span key={column.key}>{column.cell(row)}</span>
                      ))}
                    </div>
                  )}
                </div>
                {subtitleColumns.map((column) => (
                  <div key={column.key} className="text-sm text-muted-foreground">
                    {column.cell(row)}
                  </div>
                ))}
                {metaColumns.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
                    {metaColumns.map((column) => (
                      <div key={column.key} className="min-w-0">
                        <dt className="text-micro font-bold tracking-[0.07em] text-faint uppercase">{column.header}</dt>
                        <dd className="truncate text-sm text-foreground">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {rowActions && (
                <div className="-mr-2 shrink-0">
                  <RowActions actions={rowActions(row)} variant="menu" />
                </div>
              )}
            </li>
          ))}
        </ul>

        {footer}
      </div>
    </RefreshingRegion>
  );
}

interface DataListSkeletonProps {
  columns: number;
  rows: number;
}

export function DataListSkeleton({ columns, rows }: DataListSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Loading" className="border border-border bg-card">
      <div className="hidden md:block">
        <div className="h-[30px] border-b border-border bg-subtle" />
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 border-b border-border-subtle px-3 py-3 last:border-b-0">
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      <div className="divide-y divide-border-subtle md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, rowIndex) => (
          <div key={rowIndex} className="space-y-2 px-4 py-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
