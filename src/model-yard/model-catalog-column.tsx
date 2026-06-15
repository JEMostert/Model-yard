import { CheckCircle2, ChevronRight, Eye, Filter, HardDrive, Package, Search, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/types";
import { describeCapability, formatUpdatedLabel } from "@/src/model-yard/shared";

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
        <h2 className="text-xs font-semibold text-foreground">Catalog</h2>
        <span className="text-[10px] text-muted-foreground">
          {results.length === totalCount
            ? `${results.length} results`
            : `${results.length} of ${totalCount}`}
        </span>
      </div>
      <ScrollArea className="-mx-1 min-h-[480px] max-h-[calc(100vh-340px)] flex-1 px-1">
        <div className="space-y-2 pb-2">
          {results.map((model) => {
            const base = model.name.split(":")[0];
            const installed = localBaseNames.has(base);
            const caps = model.capabilities
              .map((c) => describeCapability(c))
              .filter((c): c is { label: string; Icon: typeof Eye; tone: string } => Boolean(c));
            const active = selectedModel === model.name;
            return (
              <button
                key={model.name}
                onClick={() => onLoadTags(model.name)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-xl border bg-card p-3 text-left transition-all",
                  "hover:border-primary/40 hover:bg-accent/40",
                  active
                    ? "border-primary/60 bg-accent/60 shadow-[0_0_0_1px_rgba(159,189,85,0.25),0_8px_24px_-12px_rgba(159,189,85,0.4)]"
                    : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg border text-foreground/80",
                        active
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border bg-background",
                      )}
                    >
                      <Package className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {model.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        {model.pulls && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="size-2.5 fill-current" />
                            {model.pulls}
                          </span>
                        )}
                        {model.tag_count && <span>{model.tag_count} tags</span>}
                        {model.updated && <span>· {formatUpdatedLabel(model.updated)}</span>}
                      </span>
                    </div>
                  </div>
                  {installed ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <CheckCircle2 className="size-3" />
                      local
                    </span>
                  ) : (
                    <ChevronRight
                      className={cn(
                        "mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform",
                        "group-hover:translate-x-0.5",
                        active && "text-primary",
                      )}
                    />
                  )}
                </div>

                {model.description && (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {model.description}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {caps.slice(0, 5).map(({ label, Icon, tone }) => (
                    <span
                      key={label}
                      title={label}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        tone,
                      )}
                    >
                      <Icon className="size-3" />
                      {label}
                    </span>
                  ))}
                </div>

                {model.sizes.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <HardDrive className="size-3 text-muted-foreground/80" />
                    {model.sizes.slice(0, 5).map((size) => (
                      <span
                        key={size}
                        className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground"
                      >
                        {size}
                      </span>
                    ))}
                    {model.sizes.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{model.sizes.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {!results.length && !busy && totalCount > 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Filter className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-xs font-medium">No matches with current filters</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Try removing a capability filter.
              </p>
            </div>
          )}

          {!totalCount && !busy && (
            <div className="rounded-xl border border-border bg-gradient-to-b from-card to-background p-6 text-center">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-primary/30 bg-primary/10">
                <Search className="size-4 text-primary" />
              </div>
              <p className="text-xs font-semibold">Search the Ollama library</p>
              <p className="mx-auto mt-1 max-w-[26ch] text-[11px] text-muted-foreground">
                Browse hundreds of open models. Pick a family, capability, or size to start.
              </p>
            </div>
          )}

          {busy && !totalCount && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[112px] animate-pulse rounded-xl border border-border bg-card/60"
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
