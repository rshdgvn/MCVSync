import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  isPending?: boolean;
  pendingText?: string;
}

export function LoadingButton({
  isPending = false,
  pendingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || isPending} {...props}>
      {isPending && <Loader2 className="animate-spin" />}
      {isPending ? (pendingText ?? children) : children}
    </Button>
  );
}
