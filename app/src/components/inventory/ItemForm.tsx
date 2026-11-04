import { useState, type FormEvent } from "react";
import type { ItemPayload } from "@/api/inventory";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionTitle } from "@/components/SectionTitle";
import { StickyActionBar } from "@/components/StickyActionBar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/SelectField";
import { useCategoriesQuery, useUnitsQuery } from "@/hooks/useInventory";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import type { Item } from "@/types/inventory";

interface ItemFormProps {
  initialItem?: Item;
  onSubmit: (payload: ItemPayload) => void;
  isPending: boolean;
  submitError?: unknown;
}

function toOptionalNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

function toInputValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function ItemForm({ initialItem, onSubmit, isPending, submitError }: ItemFormProps) {
  const categoriesQuery = useCategoriesQuery();
  const unitsQuery = useUnitsQuery();
  const fieldErrors = getFieldErrors(submitError);

  const [name, setName] = useState(initialItem?.name ?? "");
  const [sku, setSku] = useState(initialItem?.sku ?? "");
  const [barcode, setBarcode] = useState(initialItem?.barcode ?? "");
  const [categoryId, setCategoryId] = useState(initialItem?.category ? String(initialItem.category.id) : "");
  const [unitId, setUnitId] = useState(initialItem?.unit ? String(initialItem.unit.id) : "");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [hasExpiry, setHasExpiry] = useState(initialItem?.has_expiry ?? true);
  const [thresholdDays, setThresholdDays] = useState(toInputValue(initialItem?.expiry_alert_threshold_days));
  const [reorderPoint, setReorderPoint] = useState(toInputValue(initialItem?.reorder_point));
  const [reorderQuantity, setReorderQuantity] = useState(toInputValue(initialItem?.reorder_quantity));
  const [isActive, setIsActive] = useState(initialItem?.is_active ?? true);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    onSubmit({
      name,
      sku,
      barcode: barcode.trim() || null,
      category_id: Number(categoryId),
      unit_id: Number(unitId),
      description: description.trim() || null,
      has_expiry: hasExpiry,
      expiry_alert_threshold_days: hasExpiry ? toOptionalNumber(thresholdDays) : null,
      reorder_point: toOptionalNumber(reorderPoint),
      reorder_quantity: toOptionalNumber(reorderQuantity),
      is_active: isActive,
    });
  }

  const submitLabel = initialItem ? "Save Changes" : "Create Item";
  const generalError = getGeneralError(submitError);

  const submitButton = (
    <LoadingButton type="submit" isPending={isPending} pendingText="Saving…">
      {submitLabel}
    </LoadingButton>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="border border-border bg-card px-4 pb-5 md:px-6">
      <FormError message={generalError} />

      <SectionTitle>Details</SectionTitle>
      <div className="flex flex-col gap-4 md:gap-3.5">
        <FormField label="Item Name" htmlFor="item-name" required error={fieldErrors.name}>
          <Input
            {...fieldA11yProps("item-name", fieldErrors.name)}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField label="SKU" htmlFor="item-sku" required error={fieldErrors.sku}>
          <Input
            {...fieldA11yProps("item-sku", fieldErrors.sku)}
            required
            autoCapitalize="characters"
            className="font-mono"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
          />
        </FormField>

        <FormField label="Barcode" htmlFor="item-barcode" hint="Optional. Scan or type the code printed on the packaging." error={fieldErrors.barcode}>
          <Input
            {...fieldA11yProps("item-barcode", fieldErrors.barcode, true)}
            className="font-mono"
            value={barcode ?? ""}
            onChange={(event) => setBarcode(event.target.value)}
          />
        </FormField>

        <FormField label="Category" htmlFor="item-category" required error={fieldErrors.category_id}>
          <SelectField
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Select a category"
            triggerProps={fieldA11yProps("item-category", fieldErrors.category_id)}
            options={(categoriesQuery.data ?? []).map((category) => ({ value: String(category.id), label: category.name }))}
          />
        </FormField>

        <FormField label="Unit" htmlFor="item-unit" required error={fieldErrors.unit_id}>
          <SelectField
            value={unitId}
            onChange={setUnitId}
            placeholder="Select a unit"
            triggerProps={fieldA11yProps("item-unit", fieldErrors.unit_id)}
            options={(unitsQuery.data ?? []).map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.code})` }))}
          />
        </FormField>

        <FormField label="Description" htmlFor="item-description" hint="Optional." error={fieldErrors.description}>
          <Textarea
            {...fieldA11yProps("item-description", fieldErrors.description)}
            value={description ?? ""}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
      </div>

      <SectionTitle>Expiry</SectionTitle>
      <div className="flex flex-col gap-4 md:gap-3.5">
        <FormField
          label="Tracks Expiry"
          htmlFor="item-has-expiry"
          hint="Turn off for durable items like equipment. Their batches won't carry an expiry date."
        >
          <div className="flex min-h-11 items-center md:min-h-8">
            <Switch id="item-has-expiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
          </div>
        </FormField>

        {hasExpiry && (
          <FormField
            label="Expiry Alert"
            htmlFor="item-threshold"
            hint="Days before expiry to flag a batch. Leave blank to use the system default."
            error={fieldErrors.expiry_alert_threshold_days}
          >
            <Input
              {...fieldA11yProps("item-threshold", fieldErrors.expiry_alert_threshold_days, true)}
              inputMode="numeric"
              pattern="[0-9]*"
              className="md:w-40"
              value={thresholdDays}
              onChange={(event) => setThresholdDays(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </FormField>
        )}
      </div>

      <SectionTitle>Reordering</SectionTitle>
      <div className="flex flex-col gap-4 md:gap-3.5">
        <FormField
          label="Reorder Point"
          htmlFor="item-reorder-point"
          hint="Flag this item as low stock when available stock falls to this number."
          error={fieldErrors.reorder_point}
        >
          <Input
            {...fieldA11yProps("item-reorder-point", fieldErrors.reorder_point, true)}
            inputMode="numeric"
            pattern="[0-9]*"
            className="md:w-40"
            value={reorderPoint}
            onChange={(event) => setReorderPoint(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </FormField>

        <FormField label="Reorder Quantity" htmlFor="item-reorder-quantity" hint="Optional." error={fieldErrors.reorder_quantity}>
          <Input
            {...fieldA11yProps("item-reorder-quantity", fieldErrors.reorder_quantity, true)}
            inputMode="numeric"
            pattern="[0-9]*"
            className="md:w-40"
            value={reorderQuantity}
            onChange={(event) => setReorderQuantity(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </FormField>
      </div>

      <SectionTitle>Status</SectionTitle>
      <FormField label="Active" htmlFor="item-active" hint="Inactive items stay on record but can't be ordered.">
        <div className="flex min-h-11 items-center md:min-h-8">
          <Switch id="item-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </FormField>

      <div className="mt-6 hidden justify-end border-t border-border-subtle pt-4 md:flex">{submitButton}</div>
      <StickyActionBar>{submitButton}</StickyActionBar>
    </form>
  );
}
