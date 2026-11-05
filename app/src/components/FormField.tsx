import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  layout?: "inline" | "stacked";
  children: ReactNode;
}

export function fieldA11yProps(id: string, error?: string, hasHint = false) {
  const describedBy = error ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  layout = "inline",
  children,
}: FormFieldProps) {
  const isInline = layout === "inline";

  return (
    <div className={cn("grid gap-1.5", isInline && "md:grid-cols-[148px_minmax(0,1fr)] md:items-start md:gap-3")}>
      <Label
        htmlFor={htmlFor}
        className={cn("text-sm font-medium text-foreground-soft md:text-ui", isInline && "md:pt-2")}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </Label>
      <div className="min-w-0 space-y-1">
        {children}
        {error ? (
          <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : (
          hint && (
            <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  );
}
