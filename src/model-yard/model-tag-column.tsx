import { Check, Clock, Download, HardDrive, Package, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CatalogModel, CatalogTag } from "@/lib/types";
import { formatUpdatedLabel } from "@/src/model-yard/shared";

export function ModelTagColumn({
  busy,
  selectedCatalog,
  groupedTags,
  tagFilter,
  onTagFilterChange,
  pullBusy,
  localNames,
  onDownloadTag,
  latestStatus,
}: {
  busy: boolean;
  selectedCatalog: CatalogModel | undefined;
  groupedTags: Array<{ key: string; tags: CatalogTag[] }>;
  tagFilter: string;
  onTagFilterChange: (query: string) => void;
  pullBusy: boolean;
  localNames: Set<string>;
  onDownloadTag: (name: string) => void;
  latestStatus?: string;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-2">
      {selectedCatalog ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-background p-4">
          <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {selectedCatalog.name}
              </h2>
              {selectedCatalog.description && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {selectedCatalog.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                {selectedCatalog.pulls && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3 fill-current" />
                    {selectedCatalog.pulls} pulls
                  </span>
                )}
                {selectedCatalog.tag_count && (
                  <span className="inline-flex items-center gap-1">
                    <Package className="size-3" />
                    {selectedCatalog.tag_count} tags
                  </span>
                )}
                {selectedCatalog.updated && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatUpdatedLabel(selectedCatalog.updated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-xs font-medium text-foreground">Pick a model from the catalog</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tags and pull options will appear here.
          </p>
        </div>
      )}

      {selectedCatalog && (
        <Input
          value={tagFilter}
          onChange={(event) => onTagFilterChange(event.target.value)}
          className="h-9 rounded-lg text-xs"
          placeholder="Filter tags — quant, size, input…"
        />
      )}

      <ScrollArea className="min-h-[260px] max-h-[calc(100vh-420px)] flex-1">
        <div className="space-y-3 pr-1">
          {busy && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg border border-border bg-card/60"
                />
              ))}
            </div>
          )}

          {!busy &&
            groupedTags.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between bg-gradient-to-b from-background/95 via-background/80 to-background/0 px-1 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {group.key}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {group.tags.length} tag{group.tags.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.tags.map((tag) => {
                    const installed = localNames.has(tag.name);
                    const isPullingThis = pullBusy && latestStatus?.includes(tag.name.split(":")[1] ?? "");
                    return (
                      <div
                        key={tag.name}
                        className={cn(
                          "grid gap-2 rounded-lg border bg-card px-3 py-2 transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                          installed
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:border-primary/30",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[11px] font-medium text-foreground">
                              {tag.name}
                            </span>
                            {installed && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                                <Check className="size-2.5" />
                                local
                              </span>
                            )}
                            {isPullingThis && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-400/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                                <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
                                pulling
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            {tag.variant && <span>{tag.variant}</span>}
                            {tag.quant && (
                              <span className="rounded bg-background/60 px-1 py-px font-mono text-[9px] text-foreground/80">
                                {tag.quant}
                              </span>
                            )}
                            {tag.size && (
                              <span className="inline-flex items-center gap-0.5">
                                <HardDrive className="size-2.5" />
                                {tag.size}
                              </span>
                            )}
                            {tag.context && <span>{tag.context} ctx</span>}
                            {tag.input && <span>{tag.input}</span>}
                            {tag.updated && <span>· {formatUpdatedLabel(tag.updated)}</span>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={installed ? "outline" : "default"}
                          className="h-7 rounded-md px-2.5 text-[11px]"
                          onClick={() => onDownloadTag(tag.name)}
                          disabled={pullBusy || installed}
                        >
                          {installed ? (
                            <>
                              <Check className="size-3" />
                              Installed
                            </>
                          ) : isPullingThis ? (
                            <>
                              <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                              Pulling
                            </>
                          ) : (
                            <>
                              <Download className="size-3" />
                              Pull
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {!busy && !groupedTags.length && selectedCatalog && (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-4 text-center text-[11px] text-muted-foreground">
              No tags match this filter.
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
