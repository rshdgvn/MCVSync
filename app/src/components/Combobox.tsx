import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldControlClassName } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const needle = query.trim().toLowerCase();
  return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
}

export function Combobox({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  invalid = false,
}: ComboboxProps) {
  const isMobile = useIsMobile();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  useEffect(() => {
    if (!open || isMobile) {
      return;
    }
    function closeOnOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open, isMobile]);

  function openList() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function select(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleSearchKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      select(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const searchInput = (
    <div className="flex items-center gap-2 border-b border-border-subtle px-3">
      <Search className="size-4 shrink-0 text-faint md:size-3.5" />
      <input
        autoFocus
        type="search"
        enterKeyHint="search"
        aria-label={`Search ${label}`}
        aria-controls={listId}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleSearchKeys}
        placeholder="Search…"
        className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint md:h-9 md:text-xs"
      />
    </div>
  );

  const optionList = (
    <ul id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto py-1">
      {filtered.length === 0 && <li className="px-3 py-2.5 text-sm text-faint md:text-xs">No results</li>}
      {filtered.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <li key={option.value} role="option" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => select(option)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-base md:min-h-0 md:py-2 md:text-ui",
                isSelected ? "bg-primary-light font-semibold text-primary" : "text-foreground",
                index === activeIndex && !isSelected && "bg-subtle",
              )}
            >
              <span className="truncate">{option.label}</span>
              {isSelected && <Check className="size-4 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(fieldControlClassName, "flex h-11 items-center justify-between gap-2 text-left md:h-8")}
      >
        <span className={cn("min-w-0 truncate", !selectedLabel && "text-faint")}>{selectedLabel ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-faint" />
      </button>

      {open && !isMobile && (
        <div className="absolute top-[calc(100%+2px)] right-0 left-0 z-50 flex max-h-64 flex-col border border-border bg-popover shadow-lg">
          {searchInput}
          {optionList}
        </div>
      )}

      {isMobile && (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col bg-card outline-none transition-[transform,opacity] duration-200 ease-standard data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 pt-[env(safe-area-inset-top)]">
                <DialogPrimitive.Title className="py-3 text-base font-bold">{label}</DialogPrimitive.Title>
                <DialogPrimitive.Close render={<Button variant="ghost" size="icon" aria-label="Close" />}>
                  <X />
                </DialogPrimitive.Close>
              </div>
              {searchInput}
              <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{optionList}</div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  );
}
