import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MicroLabelProps {
  children: ReactNode;
  className?: string;
}

export function MicroLabel({ children, className }: MicroLabelProps) {
  return (
    <div className={cn("text-micro font-bold tracking-[0.08em] text-faint uppercase", className)}>{children}</div>
  );
}
