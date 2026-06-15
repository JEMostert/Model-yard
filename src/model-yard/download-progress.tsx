import { CheckCircle2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PullProgress } from "@/lib/types";

export function DownloadProgressPopup({
  model,
  open,
  pullBusy,
  progress,
  overallProgress,
  latestStatus,
  onClose,
}: {
  model: string;
  open: boolean;
  pullBusy: boolean;
  progress: PullProgress[];
  overallProgress: { completed: number; total: number; ratio: number } | null;
  latestStatus?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  const percent = overallProgress
    ? Math.min(100, Math.round(overallProgress.ratio * 100))
    : null;
  const finished = !pullBusy && progress.some((item) => /success|complete/i.test(item.status));

  return (
    <div className="fixed bottom-14 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg border",
            finished
              ? "border-primary/30 bg-primary/15 text-primary"
              : "border-amber-300/30 bg-amber-300/10 text-amber-300",
          )}>
            {finished ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {finished ? "Download complete" : "Downloading model"}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">
              {model || "Ollama model"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
          title="Hide download popup"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="min-w-0 truncate text-muted-foreground">
          {latestStatus ?? "Starting pull..."}
        </span>
        {percent !== null && (
          <span className="shrink-0 font-semibold tabular-nums text-foreground">
            {percent}%
          </span>
        )}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            finished ? "bg-primary" : "bg-amber-300",
            percent === null && "w-1/3 animate-pulse",
          )}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 max-h-16 space-y-0.5 overflow-hidden">
        {progress.slice(-3).map((item, index) => (
          <p
            key={`${item.digest ?? item.status}-${index}`}
            className="truncate text-[10px] text-muted-foreground"
          >
            {item.status}
          </p>
        ))}
      </div>
    </div>
  );
}
