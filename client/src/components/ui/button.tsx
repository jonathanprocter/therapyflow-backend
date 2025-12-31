import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "text-white hover:opacity-90 active:opacity-80" + " " + 
                 "bg-[#8EA58C] hover:bg-[#7A8F78] active:bg-[#738A6E]",
        destructive: "text-white hover:opacity-90" + " " + 
                    "bg-[#344C3D]",
        outline: "border-2 bg-transparent hover:text-white transition-all duration-200" + " " +
                "border-[#344C3D] text-[#344C3D] hover:bg-[#344C3D]",
        secondary: "border-2 bg-transparent hover:text-white transition-all duration-200" + " " +
                  "border-[#344C3D] text-[#344C3D] hover:bg-[#344C3D]",
        accent: "text-white hover:opacity-90" + " " + 
               "bg-[#88A5BC] hover:bg-[#6B8BA6]",
        ghost: "bg-transparent hover:bg-[#F2F3F1] text-[#738A6E]",
        link: "underline-offset-4 hover:underline" + " " +
              "text-[#88A5BC] hover:text-[#6B8BA6]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
