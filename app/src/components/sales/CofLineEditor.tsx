import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataList, type DataListColumn } from "@/components/DataList";
import { QuantityInput } from "@/components/QuantityInput";
import {
  draftItemFromSales,
  estimatedLineTotal,
  lineDiffers,
  type DraftCofLine,
} from "@/components/sales/cofRules";
import { SalesItemCombobox } from "@/components/sales/SalesItemCombobox";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { SalesItem } from "@/types/clientOrderForm";

interface CofLineEditorProps {
  lines: DraftCofLine[];
  onChange: (lines: DraftCofLine[]) => void;
  readOnly?: boolean;
  lineErrors?: Record<number, string>;
  newLineDiscount?: (itemId: number) => number;
}

function AwaitingAccounting() {
  return <StatusBadge status="pending" label="Awaiting Accounting" tone="neutral" />;
}

export function CofLineEditor({ lines, onChange, readOnly = false, lineErrors = {}, newLineDiscount }: CofLineEditorProps) {
  const [picking, setPicking] = useState<SalesItem | null>(null);

  function update(key: string, patch: Partial<DraftCofLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addItem(item: SalesItem) {
    setPicking(null);
    if (lines.some((line) => line.item.id === item.id)) {
      return;
    }
    onChange([
      ...lines,
      {
        key: `new-${item.id}`,
        item: draftItemFromSales(item),
        quantity: 1,
        discountPercent: newLineDiscount?.(item.id) ?? 0,
        reason: "",
        requested: lines.some((line) => line.requested !== null) ? 0 : null,
        unitCost: null,
      },
    ]);
  }

  const columns: DataListColumn<DraftCofLine & { index: number }>[] = [
    {
      key: "item",
      header: "Item",
      mobile: "title",
      cell: (line) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-medium">{line.item.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
          {lineDiffers(line) && (
            <span className="flex flex-col gap-1">
              <StatusBadge status="needs_revision" label={`Differs from request (${line.requested})`} />
              {readOnly ? (
                line.reason && <span className="text-xs text-foreground-soft">{line.reason}</span>
              ) : (
                <Input
                  aria-label={`Reason for changing ${line.item.name}`}
                  aria-invalid={Boolean(lineErrors[line.index]) || undefined}
                  placeholder="Reason for this change (required)"
                  className="text-base md:text-ui"
                  value={line.reason}
                  onChange={(event) => update(line.key, { reason: event.target.value })}
                />
              )}
            </span>
          )}
          {lineErrors[line.index] && <span className="text-xs text-danger">{lineErrors[line.index]}</span>}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      align: "right",
      cell: (line) =>
        readOnly ? (
          <span className="font-mono">{line.quantity}</span>
        ) : (
          <QuantityInput
            label={`Quantity of ${line.item.name}`}
            min={1}
            value={line.quantity}
            onChange={(quantity) => update(line.key, { quantity })}
          />
        ),
    },
    { key: "unit", header: "Unit", mobile: "meta", cell: (line) => line.item.unitCode ?? "—" },
    {
      key: "price",
      header: "Price",
      align: "right",
      mobile: "meta",
      cell: (line) => (line.unitCost === null ? <AwaitingAccounting /> : <span className="font-mono">{formatMoney(line.unitCost)}</span>),
    },
    {
      key: "discount",
      header: "Discount %",
      align: "right",
      cell: (line) =>
        readOnly ? (
          <span className="font-mono">{line.discountPercent}%</span>
        ) : (
          <Input
            aria-label={`Discount for ${line.item.name}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            className="w-24 text-right font-mono text-base md:ml-auto md:text-ui"
            value={String(line.discountPercent)}
            onChange={(event) => {
              const value = Number(event.target.value);
              update(line.key, { discountPercent: Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0 });
            }}
          />
        ),
    },
    {
      key: "total",
      header: "Line Total",
      align: "right",
      mobile: "badge",
      cell: (line) => <span className="font-mono font-semibold">{formatMoney(estimatedLineTotal(line))}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataList
        label="Order lines"
        columns={columns}
        rows={lines.map((line, index) => ({ ...line, index }))}
        rowKey={(line) => line.key}
        isPending={false}
        onRetry={() => undefined}
        empty={{ title: "No items yet", description: "Add the items the client ordered." }}
        rowActions={
          readOnly
            ? undefined
            : (line) => [
                {
                  label: "Remove",
                  icon: Trash2,
                  destructive: true,
                  disabled: lines.length <= 1,
                  onClick: () => onChange(lines.filter((candidate) => candidate.key !== line.key)),
                },
              ]
        }
      />
      {!readOnly && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full md:w-96">
            <SalesItemCombobox id="cof-add-item" value={picking} onChange={addItem} />
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Plus className="size-3.5" />
            Choose an item to add it as a new line.
          </span>
        </div>
      )}
    </div>
  );
}
