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
  tags,
  tagFilter,
  onTagFilterChange,
  pullBusy,
  localNames,
  onDownloadTag,
  latestStatus,
}: {
  busy: boolean;
  selectedCatalog: CatalogModel | undefined;
  tags: CatalogTag[];
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
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="grid size-7 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[11px] font-semibold text-foreground">
                {selectedCatalog.name}
              </h2>
              {selectedCatalog.description && (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {selectedCatalog.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2.5 text-[10px] text-muted-foreground">
                {selectedCatalog.pulls && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="size-2.5 fill-current" />
                    {selectedCatalog.pulls}
                  </span>
                )}
                {selectedCatalog.tag_count && (
                  <span className="inline-flex items-center gap-0.5">
                    <Package className="size-2.5" />
                    {selectedCatalog.tag_count} tags
                  </span>
                )}
                {selectedCatalog.updated && (
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {formatUpdatedLabel(selectedCatalog.updated)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Input
            value={tagFilter}
            onChange={(event) => onTagFilterChange(event.target.value)}
            className="h-7 rounded-md text-[10px]"
            placeholder="Filter tags…"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-[11px] text-muted-foreground">Select a model to see tags</p>
        </div>
      )}

      <ScrollArea className="min-h-[260px] max-h-[calc(100vh-420px)] flex-1">
        <div className="space-y-2 pr-1">
          {busy && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-md bg-muted/40"
                />
              ))}
            </div>
          )}

          {!busy &&
            tags.map((tag) => {
              const installed = localNames.has(tag.name);
              const isPullingThis = pullBusy && latestStatus?.includes(tag.name.split(":")[1] ?? "");
              return (
                <div
                  key={tag.name}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    installed
                      ? "bg-primary/5"
                      : "hover:bg-accent/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[10px] font-medium text-foreground">
                        {tag.name}
                      </span>
                      {installed && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider text-primary">
                          <Check className="size-2" />
                          local
                        </span>
                      )}
                      {isPullingThis && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-400">
                          <span className="size-1 animate-pulse rounded-full bg-amber-400" />
                          pulling
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                      {tag.quant && (
                        <span className="font-mono text-foreground/70">{tag.quant}</span>
                      )}
                      {tag.size && (
                        <span className="inline-flex items-center gap-0.5">
                          <HardDrive className="size-2" />
                          {tag.size}
                        </span>
                      )}
                      {tag.context && <span>{tag.context}</span>}
                      {tag.input && <span>{tag.input}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={installed ? "ghost" : "default"}
                    className="h-6 shrink-0 rounded-md px-2 text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onDownloadTag(tag.name)}
                    disabled={pullBusy || installed}
                  >
                    {installed ? (
                      <Check className="size-2.5" />
                    ) : isPullingThis ? (
                      <span className="size-2.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    ) : (
                      <Download className="size-2.5" />
                    )}
                  </Button>
                </div>
              );
            })}

          {!busy && !tags.length && selectedCatalog && (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-[10px] text-muted-foreground">
              No tags match this filter.
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
