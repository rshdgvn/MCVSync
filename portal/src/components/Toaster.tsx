import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BASE_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useToastStore, type ToastTone } from "@/stores/toast.store";

const TONE_ICON: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: AlertCircle, className: "text-danger" },
  info: { icon: Info, className: "text-info" },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] md:inset-x-auto md:top-auto md:right-6 md:bottom-6 md:items-end md:px-0 md:pt-0"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const { icon: Icon, className } = TONE_ICON[toast.tone];

          return (
            <motion.div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={BASE_TRANSITION}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 border border-border bg-card py-2 pr-2 pl-3.5 shadow-lg"
            >
              <Icon className={cn("size-4 shrink-0", className)} />
              <p className="min-w-0 flex-1 text-sm text-foreground md:text-ui">{toast.message}</p>
              {toast.action && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    toast.action?.onAction();
                    dismiss(toast.id);
                  }}
                >
                  {toast.action.label}
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
                <X />
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
