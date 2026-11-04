import { useState, type FormEvent } from "react";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import { FormError } from "@/components/FormError";
import { FormField, fieldA11yProps } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { meQueryOptions, useLoginMutation } from "@/hooks/useAuth";
import { getFieldErrors, getGeneralError } from "@/lib/errors";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch {
      return;
    }

    throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const fieldErrors = getFieldErrors(loginMutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loginMutation.mutate(
      { email, password, remember: rememberMe },
      { onSuccess: () => navigate({ to: "/" }) },
    );
  }

  return (
    <AuthCard title="Sign In" description="Order and track supplies for your clinic.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={getGeneralError(loginMutation.error)} />
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
        <FormField label="Password" htmlFor="password" layout="stacked" error={fieldErrors.password}>
          <div className="relative">
            <Input
              {...fieldA11yProps("password", fieldErrors.password)}
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-11 md:pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground md:w-9"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground md:min-h-0 md:text-ui">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline md:text-xs">
            Forgot password?
          </Link>
        </div>
        <LoadingButton
          type="submit"
          className="w-full"
          isPending={loginMutation.isPending}
          pendingText="Signing in…"
        >
          Log In
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
