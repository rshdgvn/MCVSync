import type { StockFlowLine } from "@/components/stock-flow/stockFlowLines";

export function ShortLineList({ lines }: { lines: StockFlowLine[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <li key={line.id} className="flex justify-between gap-3">
          <span className="truncate">{line.item.name}</span>
          <span className="shrink-0 font-mono">
            {line.done} / {line.target}
          </span>
        </li>
      ))}
    </ul>
  );
}
