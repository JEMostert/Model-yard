import * as React from "react";
import { cn } from "@/lib/utils";

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: "auto" | "always" | "scroll" | "hover";
};

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, type: _type, ...props }, ref) => (
    <div ref={ref} className={cn("overflow-y-auto overscroll-contain", className)} {...props}>
      {children}
    </div>
  )
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
