import type { ReactNode } from "react";

interface StickyActionBarProps {
  children: ReactNode;
}

export function StickyActionBar({ children }: StickyActionBarProps) {
  return (
    <div
      data-sticky-action-bar=""
      className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden [&>*]:flex-1"
    >
      {children}
    </div>
  );
}
