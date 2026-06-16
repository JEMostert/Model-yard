import { CheckCircle2, ChevronRight, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/types";
import { formatUpdatedLabel } from "@/src/model-yard/shared";

export function ModelCatalogColumn({
  busy,
  results,
  totalCount,
  localBaseNames,
  selectedModel,
  onLoadTags,
}: {
  busy: boolean;
  results: CatalogModel[];
  totalCount: number;
  localBaseNames: Set<string>;
  selectedModel: string;
  onLoadTags: (name: string) => void;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {results.length === totalCount
            ? `${results.length} results`
            : `${results.length} of ${totalCount}`}
        </span>
      </div>
      <ScrollArea className="-mx-1 min-h-[480px] max-h-[calc(100vh-340px)] flex-1 px-1">
        <div className="space-y-1 pb-2">
          {results.map((model) => {
            const base = model.name.split(":")[0];
            const installed = localBaseNames.has(base);
            const active = selectedModel === model.name;
            return (
              <button
                key={model.name}
                onClick={() => onLoadTags(model.name)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all",
                  active
                    ? "border-primary/50 bg-accent/60"
                    : "border-transparent hover:bg-accent/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {model.name}
                    </span>
                    {installed && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-primary">
                        <CheckCircle2 className="size-2.5" />
                        local
                      </span>
                    )}
                  </div>
                  {model.description && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {model.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[10px] text-muted-foreground">
                  {model.pulls && <span>{model.pulls}</span>}
                  {model.tag_count && <span>{model.tag_count} tags</span>}
                  {model.updated && <span>{formatUpdatedLabel(model.updated)}</span>}
                </div>
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground/50 transition-all",
                    "group-hover:translate-x-0.5 group-hover:text-muted-foreground",
                    active && "text-primary",
                  )}
                />
              </button>
            );
          })}

          {!results.length && !busy && totalCount > 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">No matches with current filters</p>
            </div>
          )}

          {!totalCount && !busy && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Search className="mx-auto mb-2 size-4 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">Search the Ollama library</p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Browse hundreds of open models.
              </p>
            </div>
          )}

          {busy && !totalCount && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-muted/40"
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
