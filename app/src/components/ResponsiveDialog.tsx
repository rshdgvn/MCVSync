import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-[35rem]",
  lg: "md:max-w-[45rem]",
};

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: ResponsiveDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-200 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col border border-border bg-card text-card-foreground shadow-xl outline-none",
            "transition-[transform,opacity] duration-200 ease-standard data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[88dvh] md:w-full md:-translate-x-1/2 md:-translate-y-1/2",
            "md:data-ending-style:-translate-y-[48%] md:data-ending-style:opacity-0 md:data-starting-style:-translate-y-[48%] md:data-starting-style:opacity-0",
            SIZE_CLASS[size],
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 bg-border md:hidden" />
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-bold text-foreground md:text-sm">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground md:text-xs">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2" />}>
              <X />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:flex-row md:justify-end md:px-5 md:pb-3">
              {footer}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
