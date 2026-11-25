import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ShortageSummary } from "@/components/stock-flow/ShortageSummary";
import { Button } from "@/components/ui/button";
import type { InsufficientStock } from "@/types/transfer";

interface ForwardShortageDialogProps {
  shortage: InsufficientStock;
  itemName: string;
  unit: string | null;
  onClose: () => void;
}

export function ForwardShortageDialog({ shortage, itemName, unit, onClose }: ForwardShortageDialogProps) {
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Not Enough Stock to Forward"
      description={
        <>
          <span className="font-semibold text-foreground">{itemName}</span> doesn't have enough available stock, so nothing
          was reserved and the order stays Pending Approval.
        </>
      }
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-3">
        <ShortageSummary requested={shortage.requested} available={shortage.available} unit={unit} />
        <p className="text-sm text-foreground-soft md:text-ui">
          A draft supplier PO was created for the shortfall so Purchasing can restock. Forward again once the stock arrives.
        </p>
      </div>
    </ResponsiveDialog>
  );
}
