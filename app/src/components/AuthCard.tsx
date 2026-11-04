import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm border border-border bg-card px-5 py-6 md:px-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center bg-primary text-primary-foreground">
            <BrandMark className="size-4" />
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-foreground">MCVSync</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground md:text-ui">{description}</p>}
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-5 border-t border-border-subtle pt-4 text-center">{footer}</div>}
      </div>
    </main>
  );
}
