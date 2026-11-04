import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { Input } from "@/components/ui/input";
import { SubmitForm } from "@/components/SubmitForm";
import { useResetPasswordMutation } from "@/hooks/useAuth";
import { getFieldErrors, getGeneralError } from "@/lib/errors";
import { toast } from "@/stores/toast.store";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: String(search.token ?? ""),
    email: String(search.email ?? ""),
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, email } = Route.useSearch();
  const navigate = useNavigate();
  const resetPasswordMutation = useResetPasswordMutation();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const fieldErrors = getFieldErrors(resetPasswordMutation.error);

  function handleSubmit() {
    return resetPasswordMutation.mutateAsync(
      { token, email, password, password_confirmation: passwordConfirmation },
      {
        onSuccess: () => {
          toast.success("Password updated. Sign in with your new password.");
          void navigate({ to: "/login" });
        },
      },
    );
  }

  return (
    <AuthCard
      title="Set a New Password"
      description={email ? `For ${email}` : undefined}
      footer={
        <Link to="/login" className="text-sm font-medium text-primary hover:underline md:text-xs">
          Back to Sign In
        </Link>
      }
    >
      <SubmitForm onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormError message={getGeneralError(resetPasswordMutation.error) ?? fieldErrors.email ?? fieldErrors.token} />
        <FormField
          label="New Password"
          htmlFor="password"
          layout="stacked"
          hint="At least 8 characters."
          error={fieldErrors.password}
        >
          <Input
            {...fieldA11yProps("password", fieldErrors.password, true)}
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Confirm Password" htmlFor="password_confirmation" layout="stacked">
          <Input
            id="password_confirmation"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
        </FormField>
        <LoadingButton
          type="submit"
          className="w-full"
          isPending={resetPasswordMutation.isPending}
          pendingText="Saving…"
        >
          Save New Password
        </LoadingButton>
      </SubmitForm>
    </AuthCard>
  );
}
