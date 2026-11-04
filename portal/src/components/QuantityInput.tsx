import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  label: string;
  disabled?: boolean;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  id,
  label,
  disabled = false,
  className,
}: QuantityInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isNaN(parsed) ? min : clamp(parsed, min, max);
    setDraft(String(next));
    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <div className={cn("flex items-stretch", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1, min, max))}
      >
        <Minus />
      </Button>
      <Input
        id={id}
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(event.currentTarget.value);
          }
        }}
        className="-mx-px h-11 w-16 text-center font-mono tabular-nums md:h-7 md:w-14"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1, min, max))}
      >
        <Plus />
      </Button>
    </div>
  );
}
