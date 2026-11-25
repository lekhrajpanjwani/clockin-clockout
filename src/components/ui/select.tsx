import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Native <select> styled to match <Input>. Native keeps it accessible and
 * mobile-friendly without pulling in another Radix primitive. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-input bg-card py-2 pl-3 pr-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = "Select";
