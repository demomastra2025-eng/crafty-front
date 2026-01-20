import * as React from "react";

import { cn } from "@/lib/utils";

const ButtonGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="button-group"
      className={cn(
        "inline-flex items-center",
        "[&>button+button]:-ml-px [&>div+div]:-ml-px",
        "[&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md",
        "[&>div]:rounded-none [&>div:first-child]:rounded-l-md [&>div:last-child]:rounded-r-md",
        "[&>button]:focus-visible:z-10 [&>div]:focus-within:z-10",
        className
      )}
      {...props}
    />
  )
);
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
