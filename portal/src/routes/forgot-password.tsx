import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { Input } from "@/components/ui/input";
import { useForgotPasswordMutation } from "@/hooks/useAuth";
import { getFieldErrors, getGeneralError } from "@/lib/errors";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const forgotPasswordMutation = useForgotPasswordMutation();
  const [email, setEmail] = useState("");
  const fieldErrors = getFieldErrors(forgotPasswordMutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    forgotPasswordMutation.mutate({ email });
  }

  return (
    <AuthCard
      title="Reset Your Password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link to="/login" className="text-sm font-medium text-primary hover:underline md:text-xs">
          Back to Sign In
        </Link>
      }
    >
      {forgotPasswordMutation.isSuccess ? (
        <p role="status" className="flex items-start gap-2 bg-success-muted px-3 py-2.5 text-sm text-success md:text-xs">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          If that account exists, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={getGeneralError(forgotPasswordMutation.error)} />
          <FormField label="Email Address" htmlFor="email" layout="stacked" error={fieldErrors.email}>
            <Input
              {...fieldA11yProps("email", fieldErrors.email)}
              type="email"
              inputMode="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <LoadingButton
            type="submit"
            className="w-full"
            isPending={forgotPasswordMutation.isPending}
            pendingText="Sending…"
          >
            Send Reset Link
          </LoadingButton>
        </form>
      )}
    </AuthCard>
  );
}
