import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-standard outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border bg-card text-foreground-soft hover:border-faint hover:bg-subtle hover:text-foreground aria-expanded:bg-subtle aria-expanded:text-foreground",
        secondary:
          "border-primary bg-card text-primary hover:bg-primary-light aria-expanded:bg-primary-light",
        ghost:
          "text-muted-foreground hover:bg-subtle hover:text-foreground aria-expanded:bg-subtle aria-expanded:text-foreground",
        destructive:
          "border-danger-muted bg-danger-muted text-danger hover:border-danger hover:bg-danger hover:text-primary-foreground focus-visible:border-danger focus-visible:ring-danger/20",
        link: "h-auto! px-0! text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-1.5 px-4 text-sm md:h-8 md:px-3.5 md:text-ui has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-11 gap-1 px-3 text-sm md:h-6 md:px-2 md:text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 px-3 text-sm md:h-7 md:px-2.5 md:text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-1.5 px-5 text-base md:h-9 md:px-4 md:text-sm",
        icon: "size-11 md:size-8",
        "icon-xs": "size-11 md:size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-11 md:size-7",
        "icon-lg": "size-12 md:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
