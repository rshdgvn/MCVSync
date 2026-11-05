import type { PurchaseOrderHeaderPayload } from "@/api/purchaseOrders";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface PurchaseOrderHeaderValues {
  requestDeliveryDate: string;
  terms: string;
  remarks: string;
}

export const HEADER_FIELDS = ["request_delivery_date", "terms", "remarks"] as const;

const TERMS_MAX_LENGTH = 255;

export function toHeaderValues(source?: {
  request_delivery_date: string | null;
  terms: string | null;
  remarks: string | null;
}): PurchaseOrderHeaderValues {
  return {
    requestDeliveryDate: source?.request_delivery_date ?? "",
    terms: source?.terms ?? "",
    remarks: source?.remarks ?? "",
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toHeaderPayload(values: PurchaseOrderHeaderValues): PurchaseOrderHeaderPayload {
  return {
    request_delivery_date: blankToNull(values.requestDeliveryDate),
    terms: blankToNull(values.terms),
    remarks: blankToNull(values.remarks),
  };
}

interface PurchaseOrderHeaderFieldsProps {
  values: PurchaseOrderHeaderValues;
  onChange: (values: PurchaseOrderHeaderValues) => void;
  fieldErrors: Record<string, string | undefined>;
  minDeliveryDate?: string;
}

export function PurchaseOrderHeaderFields({ values, onChange, fieldErrors, minDeliveryDate }: PurchaseOrderHeaderFieldsProps) {
  return (
    <>
      <FormField label="Request Delivery" htmlFor="po-delivery-date" error={fieldErrors.request_delivery_date}>
        <Input
          {...fieldA11yProps("po-delivery-date", fieldErrors.request_delivery_date)}
          type="date"
          min={minDeliveryDate}
          className="md:w-48"
          value={values.requestDeliveryDate}
          onChange={(event) => onChange({ ...values, requestDeliveryDate: event.target.value })}
        />
      </FormField>
      <FormField label="Terms" htmlFor="po-terms" hint="For example COD or 30 Days." error={fieldErrors.terms}>
        <Input
          {...fieldA11yProps("po-terms", fieldErrors.terms)}
          maxLength={TERMS_MAX_LENGTH}
          className="md:w-48"
          value={values.terms}
          onChange={(event) => onChange({ ...values, terms: event.target.value })}
        />
      </FormField>
      <FormField label="Remarks" htmlFor="po-remarks" error={fieldErrors.remarks}>
        <Textarea
          {...fieldA11yProps("po-remarks", fieldErrors.remarks)}
          rows={2}
          value={values.remarks}
          onChange={(event) => onChange({ ...values, remarks: event.target.value })}
        />
      </FormField>
    </>
  );
}
