import { useState } from "react";
import { PAYMENT_METHOD_LABELS, paymentReferenceLabel } from "@/api/payments";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SelectField } from "@/components/SelectField";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApprovePaymentMutation } from "@/hooks/usePayments";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { formatMoney, toIsoDate } from "@/lib/format";
import { toast } from "@/stores/toast.store";
import type { Payment, PaymentMethod } from "@/types/accounting";

const APPROVE_FIELDS = ["method", "date_received", "reference_note"] as const;
const NOTE_MAX_LENGTH = 255;

interface ApprovePaymentDialogProps {
  payment: Payment;
  onClose: () => void;
}

export function ApprovePaymentDialog({ payment, onClose }: ApprovePaymentDialogProps) {
  const mutation = useApprovePaymentMutation();
  const today = toIsoDate(new Date());
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [dateReceived, setDateReceived] = useState(today);
  const [note, setNote] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const fieldErrors: Record<string, string> = { ...getFieldErrors(mutation.error), ...clientErrors };
  const reference = paymentReferenceLabel(payment);

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!method) {
      errors.method = "Choose how the payment was received.";
    }
    if (!dateReceived) {
      errors.date_received = "Enter the date the payment was received.";
    } else if (dateReceived > today) {
      errors.date_received = "The date received can't be in the future.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !method) {
      return;
    }
    return mutation.mutateAsync(
      { id: payment.id, payload: { method, date_received: dateReceived, reference_note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success(`${reference} marked as paid.`);
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Approve Payment"
      description={
        <>
          {reference} · <span className="font-mono font-semibold text-foreground">{formatMoney(payment.order_total)}</span> ·{" "}
          {payment.payment_terms}
        </>
      }
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="approve-payment-form" isPending={mutation.isPending} pendingText="Confirming…">
            Confirm Payment
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="approve-payment-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, APPROVE_FIELDS)} />
        <FormField label="Payment Method" htmlFor="payment-method" required error={fieldErrors.method}>
          <SelectField
            value={method}
            onChange={(value) => {
              setMethod(value as PaymentMethod);
              setClientErrors(({ method: _removed, ...rest }) => rest);
            }}
            placeholder="Choose a method"
            triggerProps={{ id: "payment-method", className: "w-full md:w-56", "aria-label": "Payment method" }}
            options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => ({
              value,
              label: PAYMENT_METHOD_LABELS[value],
            }))}
          />
        </FormField>
        <FormField label="Date Received" htmlFor="payment-date" required error={fieldErrors.date_received}>
          <Input
            {...fieldA11yProps("payment-date", fieldErrors.date_received)}
            type="date"
            max={today}
            className="md:w-48"
            value={dateReceived}
            onChange={(event) => setDateReceived(event.target.value)}
          />
        </FormField>
        <FormField label="Reference" htmlFor="payment-note" error={fieldErrors.reference_note}>
          <Input
            {...fieldA11yProps("payment-note", fieldErrors.reference_note)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Check #, transfer reference, etc. (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
