import * as React from "react"
import { cn } from "../../lib/utils"

const Switch = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary",
        className,
      )}
      data-checked={props.checked ? "" : undefined}
    >
      <input type="checkbox" className="peer sr-only" ref={ref} {...props} />
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-5",
          props.checked ? "translate-x-5" : "translate-x-0",
        )}
        data-checked={props.checked ? "" : undefined}
      />
    </label>
  ),
)
Switch.displayName = "Switch"

export { Switch }
