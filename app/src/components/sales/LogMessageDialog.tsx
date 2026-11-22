import { useState } from "react";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, MESSAGE_CHANNELS } from "@/api/incomingMessages";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ClientCombobox } from "@/components/sales/ClientCombobox";
import { SelectField } from "@/components/SelectField";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLogMessageMutation } from "@/hooks/useIncomingMessages";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { ClientProfile, MessageChannel } from "@/types/clientOrderForm";

const FIELDS = ["client_id", "channel", "attachment", "received_at", "notes"];
const NOTES_MAX_LENGTH = 2000;

interface LogMessageDialogProps {
  onClose: () => void;
}

function nowForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function LogMessageDialog({ onClose }: LogMessageDialogProps) {
  const [progress, setProgress] = useState(0);
  const mutation = useLogMessageMutation(setProgress);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [channel, setChannel] = useState<MessageChannel | "">("");
  const [receivedAt, setReceivedAt] = useState(nowForInput);
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const fieldErrors = { ...getFieldErrors(mutation.error), ...clientErrors };

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!client) {
      errors.client_id = "Choose the client who sent this order.";
    }
    if (!channel) {
      errors.channel = "Choose where the order came in.";
    }
    if (!attachment) {
      errors.attachment = "Attach the screenshot or file the client sent.";
    } else if (attachment.size > MAX_ATTACHMENT_BYTES) {
      errors.attachment = "The attachment can be at most 10 MB.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0 || !client || !channel || !attachment) {
      return;
    }
    setProgress(0);
    return mutation.mutateAsync(
      {
        client_id: client.id,
        channel,
        attachment,
        received_at: receivedAt ? new Date(receivedAt).toISOString() : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Message from ${client.name} logged.`);
          onClose();
        },
      },
    );
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      title="Log Message"
      description="Record an order a client sent by Messenger, Viber or email, with the file they sent."
      footer={
        <>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="log-message-form"
            isPending={mutation.isPending}
            pendingText={progress < 100 ? `Uploading ${progress}%` : "Saving…"}
          >
            Log Message
          </LoadingButton>
        </>
      }
    >
      <SubmitForm id="log-message-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={getGeneralError(mutation.error, FIELDS)} />
        <FormField label="Client" htmlFor="message-client" required error={fieldErrors.client_id}>
          <ClientCombobox id="message-client" value={client} invalid={Boolean(fieldErrors.client_id)} onChange={setClient} />
        </FormField>
        <FormField label="Channel" htmlFor="message-channel" required error={fieldErrors.channel}>
          <SelectField
            value={channel}
            onChange={(value) => setChannel(value as MessageChannel)}
            placeholder="Choose a channel"
            triggerProps={{ ...fieldA11yProps("message-channel", fieldErrors.channel), className: "w-full md:w-56" }}
            options={MESSAGE_CHANNELS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </FormField>
        <FormField label="Received" htmlFor="message-received" error={fieldErrors.received_at}>
          <Input
            {...fieldA11yProps("message-received", fieldErrors.received_at)}
            type="datetime-local"
            max={nowForInput()}
            className="md:w-56"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
          />
        </FormField>
        <FormField
          label="Attachment"
          htmlFor="message-attachment"
          required
          hint="PDF or image, up to 10 MB."
          error={fieldErrors.attachment}
        >
          <Input
            {...fieldA11yProps("message-attachment", fieldErrors.attachment, true)}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
          />
        </FormField>
        {mutation.isPending && (
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full bg-subtle"
          >
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        )}
        <FormField label="Notes" htmlFor="message-notes" hint="Optional." error={fieldErrors.notes}>
          <Textarea
            {...fieldA11yProps("message-notes", fieldErrors.notes, true)}
            rows={2}
            maxLength={NOTES_MAX_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </SubmitForm>
    </ResponsiveDialog>
  );
}
