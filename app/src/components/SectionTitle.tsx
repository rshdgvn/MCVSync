import type { ReactNode } from "react";
import { MicroLabel } from "@/components/MicroLabel";

interface SectionTitleProps {
  children: ReactNode;
  actions?: ReactNode;
}

export function SectionTitle({ children, actions }: SectionTitleProps) {
  return (
    <div className="mt-5 mb-3 flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
      <MicroLabel>{children}</MicroLabel>
      {actions}
    </div>
  );
}
