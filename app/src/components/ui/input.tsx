import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const fieldControlClassName =
  "w-full min-w-0 rounded-none border border-input bg-card px-2.5 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-standard outline-none placeholder:text-faint focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 read-only:bg-subtle aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/10 md:text-ui"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClassName,
        "h-11 py-1 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground md:h-8",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldControlClassName }
