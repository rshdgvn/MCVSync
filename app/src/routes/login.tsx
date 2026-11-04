import { useState, type FormEvent } from "react";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LoadingButton } from "@/components/LoadingButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meQueryOptions, useLoginMutation } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";

const FEATURE_PILLS = ["Real-time Tracking", "Expiry Alerts", "Auto Reorder"];

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loginMutation.mutate(
      { email, password, remember: rememberMe },
      { onSuccess: () => navigate({ to: "/" }) },
    );
  }

  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-primary-foreground lg:flex lg:w-[45%]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,var(--sidebar-accent),transparent_60%)]" />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <BrandMark className="size-24 text-primary-foreground/90" />
          <div>
            <p className="text-2xl font-bold tracking-tight">MCVSYNC</p>
            <p className="text-xs tracking-[0.2em] text-sidebar-foreground">
              CENTRALIZE INVENTORY MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          <h1 className="text-3xl leading-tight font-bold">
            Helping Doctors,
            <br />
            <span className="text-sidebar-icon-active">Help their Patients.</span>
          </h1>
          <p className="text-sm text-sidebar-hover-foreground">
            A centralized system for tracking medical inventory — medicines, equipment, and
            machines — so healthcare providers can focus on what matters most.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURE_PILLS.map((feature) => (
              <span
                key={feature}
                className="border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-1 text-xs font-medium"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your MCVSync account to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{getErrorMessage(loginMutation.error)}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@clinic.ph"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
            </div>

            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground md:min-h-0">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              Remember me
            </label>

            <LoadingButton
              type="submit"
              className="w-full"
              isPending={loginMutation.isPending}
              pendingText="Signing in..."
            >
              Log In
            </LoadingButton>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            MCVSync © {new Date().getFullYear()} · Medical Inventory Management
          </p>
        </div>
      </div>
    </div>
  );
}
