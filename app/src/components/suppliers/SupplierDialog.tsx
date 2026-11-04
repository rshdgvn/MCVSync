import { useState } from "react";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSupplierMutation, useUpdateSupplierMutation } from "@/hooks/useSuppliers";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { SupplierPayload } from "@/api/suppliers";
import type { Supplier } from "@/types/supplier";

const TEXT_MAX_LENGTH = 255;

interface SupplierFormValues {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

function toFormValues(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? "",
    contact_person: supplier?.contact_person ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toPayload(values: SupplierFormValues): SupplierPayload {
  return {
    name: values.name.trim(),
    contact_person: blankToNull(values.contact_person),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    address: blankToNull(values.address),
  };
}

interface SupplierDialogProps {
  supplier?: Supplier;
  onClose: () => void;
}

export function SupplierDialog({ supplier, onClose }: SupplierDialogProps) {
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const [values, setValues] = useState(() => toFormValues(supplier));
  const mutation = supplier ? updateMutation : createMutation;
  const fieldErrors = getFieldErrors(mutation.error);
  const generalError = getGeneralError(mutation.error);

  function setField(field: keyof SupplierFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    const payload = toPayload(values);
    if (supplier) {
      return updateMutation.mutateAsync(
        { id: supplier.id, payload },
        {
          onSuccess: () => {
            toast.success("Supplier updated.");
            onClose();
          },
        },
      );
    }
    return createMutation.mutateAsync(payload, {
      onSuccess: (created) => {
        toast.success(`${created.name} added.`);
        onClose();
      },
    });
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title={supplier ? "Edit Supplier" : "Add New Supplier"}
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="supplier-form" isPending={mutation.isPending} pendingText="Saving…">
            {supplier ? "Save Changes" : "Add Supplier"}
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="supplier-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={generalError} />
        <FormField label="Name" htmlFor="supplier-name" required error={fieldErrors.name}>
          <Input
            {...fieldA11yProps("supplier-name", fieldErrors.name)}
            autoFocus
            required
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="organization"
            placeholder="e.g. Acme Medical Supplies"
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
          />
        </FormField>
        <FormField label="Contact Person" htmlFor="supplier-contact-person" error={fieldErrors.contact_person}>
          <Input
            {...fieldA11yProps("supplier-contact-person", fieldErrors.contact_person)}
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="name"
            value={values.contact_person}
            onChange={(event) => setField("contact_person", event.target.value)}
          />
        </FormField>
        <FormField label="Contact #" htmlFor="supplier-phone" error={fieldErrors.phone}>
          <Input
            {...fieldA11yProps("supplier-phone", fieldErrors.phone)}
            type="tel"
            inputMode="tel"
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => setField("phone", event.target.value)}
          />
        </FormField>
        <FormField label="Email" htmlFor="supplier-email" error={fieldErrors.email}>
          <Input
            {...fieldA11yProps("supplier-email", fieldErrors.email)}
            type="email"
            inputMode="email"
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="email"
            value={values.email}
            onChange={(event) => setField("email", event.target.value)}
          />
        </FormField>
        <FormField label="Address" htmlFor="supplier-address" error={fieldErrors.address}>
          <Textarea
            {...fieldA11yProps("supplier-address", fieldErrors.address)}
            rows={2}
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="street-address"
            value={values.address}
            onChange={(event) => setField("address", event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
