import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpDown,
  Brain,
  Code2,
  Eye,
  Filter,
  Hash,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CatalogModel, CatalogTag, OllamaModel, PullProgress, RunningModel } from "@/lib/types";
import { ModelCatalogColumn } from "@/src/model-yard/model-catalog-column";
import { ModelTagColumn } from "@/src/model-yard/model-tag-column";
import { describeCapability, parsePullCount, quantKey } from "@/src/model-yard/shared";

export function ModelBrowserWorkspace({
  catalogBusy,
  catalogQuery,
  catalogResults,
  catalogTagFilter,
  catalogTags,
  models,
  pullProgress,
  selectedModel,
  selectedCatalogModel,
  running,
  onCatalogQueryChange,
  onCatalogTagFilterChange,
  onDownloadCatalogTag,
  onLoadCatalogTags,
  onRefresh,
  onSearchCatalog,
  onSelectModel,
}: {
  catalogBusy: string;
  catalogQuery: string;
  catalogResults: CatalogModel[];
  catalogTagFilter: string;
  catalogTags: CatalogTag[];
  models: OllamaModel[];
  pullProgress: PullProgress[];
  selectedModel: string;
  selectedCatalogModel: string;
  running: RunningModel[];
  onCatalogQueryChange: (query: string) => void;
  onCatalogTagFilterChange: (query: string) => void;
  onDownloadCatalogTag: (name: string) => void;
  onLoadCatalogTags: (model: string) => void;
  onRefresh: () => void;
  onSearchCatalog: () => void;
  onSelectModel: (model: string) => void;
}) {
  const [capabilityFilter, setCapabilityFilter] = useState<string[]>([]);
  const [installedFilter, setInstalledFilter] = useState<"all" | "available" | "installed">("all");
  const [sortBy, setSortBy] = useState<"pulls" | "updated" | "name">("pulls");

  const localNames = useMemo(() => new Set(models.map((model) => model.name)), [models]);
  const localBaseNames = useMemo(
    () => new Set(models.map((model) => model.name.split(":")[0])),
    [models],
  );

  const filteredResults = useMemo(() => {
    let out = catalogResults;
    if (capabilityFilter.length) {
      out = out.filter((model) =>
        capabilityFilter.every((cap) =>
          model.capabilities.some((c) => describeCapability(c)?.label === cap),
        ),
      );
    }
    if (installedFilter !== "all") {
      out = out.filter((model) => {
        const base = model.name.split(":")[0];
        const hasLocalTag = model.name
          ? Array.from(localNames).some((name) => name.split(":")[0] === base)
          : false;
        const isInstalled = localBaseNames.has(base) || hasLocalTag;
        return installedFilter === "installed" ? isInstalled : !isInstalled;
      });
    }
    const sorted = [...out];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "updated") {
      sorted.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
    } else {
      sorted.sort((a, b) => {
        const pa = parsePullCount(a.pulls);
        const pb = parsePullCount(b.pulls);
        return pb - pa;
      });
    }
    return sorted;
  }, [catalogResults, capabilityFilter, installedFilter, sortBy, localNames, localBaseNames]);

  const filteredTags = useMemo(() => {
    const query = catalogTagFilter.trim().toLowerCase();
    if (!query) return catalogTags;
    return catalogTags.filter((tag) =>
      [tag.name, tag.quant, tag.variant, tag.size, tag.context, tag.input]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [catalogTagFilter, catalogTags]);

  const groupedTags = useMemo(() => {
    const order = [
      "Q8 — near lossless",
      "Q6 — high quality",
      "Q5 — quality",
      "Q4 — balanced",
      "Lower precision",
      "F16 — full precision",
      "F32 — full precision",
      "MLX",
      "Other",
      "Standard",
    ];
    const map = new Map<string, CatalogTag[]>();
    for (const tag of filteredTags) {
      const key = quantKey(tag.quant);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tag);
    }
    return order
      .filter((key) => map.has(key))
      .map((key) => ({ key, tags: map.get(key)! }));
  }, [filteredTags]);

  const selectedCatalog = catalogResults.find((m) => m.name === selectedCatalogModel);
  const latestProgress = pullProgress[pullProgress.length - 1];

  const toggleCapability = (label: string) => {
    setCapabilityFilter((current) =>
      current.includes(label) ? current.filter((c) => c !== label) : [...current, label],
    );
  };

  const popularSuggestions = ["llama3.2", "qwen2.5", "gemma3", "phi3", "mistral", "deepseek-r1"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Models
          </p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">
            Browser
          </h1>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Search the Ollama library and pull tags into your local runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground sm:flex">
            <Sparkles className="size-3 text-primary" />
            {catalogResults.length} results
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={onRefresh}
          >
            <ArrowDownToLine className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl border-border bg-card">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogQuery}
                onChange={(event) => onCatalogQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSearchCatalog();
                }}
                className="h-10 rounded-lg border-border/80 bg-background pl-9 pr-3 text-sm"
                placeholder="Search Ollama library — try llama, qwen, deepseek…"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-10 rounded-lg text-xs">
                <ArrowUpDown className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pulls">Most popular</SelectItem>
                <SelectItem value="updated">Recently updated</SelectItem>
                <SelectItem value="name">Name (A→Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="h-10 rounded-lg text-xs"
              onClick={onSearchCatalog}
              disabled={catalogBusy === "catalog-search"}
            >
              {catalogBusy === "catalog-search" ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="size-3.5" />
                  Search
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="size-3" />
              Filters
            </span>
            {[
              { id: "all", label: "All" },
              { id: "available", label: "Not installed" },
              { id: "installed", label: "Installed" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setInstalledFilter(opt.id as typeof installedFilter)}
                className={cn(
                  "h-6 rounded-md border px-2 text-[10px] font-medium transition-colors",
                  installedFilter === opt.id
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
            <Separator orientation="vertical" className="mx-1 h-4" />
            {[
              { id: "vision", label: "vision", Icon: Eye },
              { id: "tools", label: "tools", Icon: Wrench },
              { id: "code", label: "code", Icon: Code2 },
              { id: "thinking", label: "thinking", Icon: Brain },
              { id: "embeddings", label: "embeddings", Icon: Hash },
            ].map((opt) => {
              const active = capabilityFilter.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleCapability(opt.id)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium transition-colors",
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <opt.Icon className="size-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {!catalogResults.length && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground">Try:</span>
              {popularSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    onCatalogQueryChange(suggestion);
                  }}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <ModelCatalogColumn
          busy={catalogBusy === "catalog-search"}
          results={filteredResults}
          totalCount={catalogResults.length}
          localBaseNames={localBaseNames}
          selectedModel={selectedCatalogModel}
          onLoadTags={onLoadCatalogTags}
        />

        <ModelTagColumn
          busy={catalogBusy === `catalog-tags-${selectedCatalogModel}`}
          selectedCatalog={selectedCatalog}
          groupedTags={groupedTags}
          tagFilter={catalogTagFilter}
          onTagFilterChange={onCatalogTagFilterChange}
          pullBusy={catalogBusy === "pull"}
          localNames={localNames}
          onDownloadTag={onDownloadCatalogTag}
          latestStatus={latestProgress?.status}
        />
      </div>
    </div>
  );
}
