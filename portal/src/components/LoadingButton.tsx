import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubmitOnce, type SubmitHandler } from "@/hooks/useSubmitOnce";
import type { ComponentProps } from "react";

interface LoadingButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  isPending?: boolean;
  pendingText?: string;
  onClick?: SubmitHandler;
}

export function LoadingButton({
  isPending = false,
  pendingText,
  children,
  disabled,
  onClick,
  ...props
}: LoadingButtonProps) {
  const submitOnce = useSubmitOnce();

  return (
    <Button disabled={disabled || isPending} onClick={onClick && (() => submitOnce(onClick))} {...props}>
      {isPending && <Loader2 className="animate-spin" />}
      {isPending ? (pendingText ?? children) : children}
    </Button>
  );
}
