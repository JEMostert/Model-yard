import type { ReactNode } from "react";
import { ChevronRight, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { msFromNs } from "@/lib/format";
import type { RunResult } from "@/lib/types";
import { formatCount, formatModelLabel, formatTime } from "@/src/model-yard/shared";

export function ConfigSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between border-b border-border px-2 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground select-none">
        {title}
        <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" />
      </summary>
      <div className="px-2 pb-2 pt-2">
        {children}
      </div>
    </details>
  );
}

export function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <strong
        className={cn(
          "truncate text-right font-medium",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </strong>
    </div>
  );
}

export function Setting({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="tabular-nums text-[11px] font-medium text-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  );
}
